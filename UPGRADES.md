# Guias de Upgrade

O boilerplate vem com o mínimo para funcionar (Postgres + Better Auth + OpenAPI).
Estes guias adicionam serviços comuns conforme o projeto cresce. Cada um é
independente — adicione só o que precisar.

---

## Redis (cache / sessão secundária / rate-limit distribuído)

Útil para acelerar a sessão do Better Auth (`secondaryStorage`), cache da
aplicação e rate-limit compartilhado entre instâncias. O serviço `redis` já vem
habilitado no `docker-compose.yml` (usado pelos jobs — ver seção abaixo).

1. **.env** — preencha `REDIS_URL` (suba o Redis com `pnpm dep-up`). A var já
   existe no schema de `environment.ts`.
2. **apps/api** — instale o cliente e o storage (o `ioredis` já vem via `@repo/jobs`):
   ```bash
   pnpm --filter @repo/api add @better-auth/redis-storage
   ```
3. **apps/api/src/utils/redis.ts** — crie o cliente:
   ```ts
   import { Redis } from 'ioredis'
   import { env } from '@/utils/environment.js'
   export const redis = new Redis(env.REDIS_URL)
   ```
4. **better-auth/configs.ts** — ligue o storage secundário:
   ```ts
   import { redisStorage } from '@better-auth/redis-storage'
   import { redis } from '@/utils/redis.js'
   // dentro de createAuthConfig():
   secondaryStorage: redisStorage({ client: redis, keyPrefix: 'better-auth:' }),
   rateLimit: { storage: 'secondary-storage' },
   ```

---

## Jobs em background (BullMQ + Redis)

Já vem implementado no pacote **`@repo/jobs`** (infra de fila genérica com BullMQ)
+ handlers em `apps/api/src/jobs`. Segue a filosofia do boilerplate: **funciona
sem infra**.

**Como funciona:**

- **Sem `REDIS_URL`** — `enqueue(...)` roda o handler **inline** (síncrono). O app
  funciona em dev sem fila/worker. O payload continua sendo validado: o modo dev
  não pode ser mais frouxo que produção, senão o erro só aparece no deploy.
- **Com `REDIS_URL`** — vira fila de verdade: `enqueue` publica no Redis e o worker
  processa com **retries + backoff exponencial** (3 tentativas por padrão). Jobs
  **agendados** (cron) via `upsertJobScheduler`, **dead-letter queue** e painel
  de inspeção.

**Ativar:**

1. **.env** — preencha `REDIS_URL` (`pnpm dep-up` sobe o Redis).
2. Pronto. A API sobe o worker in-process por padrão (`JOBS_IN_PROCESS=true`).

### Contratos: payload validado com Zod

Todo job tem um **schema Zod obrigatório** (`apps/api/src/jobs/schemas.ts`), no
mesmo padrão dos módulos da API. O tipo do handler é derivado do schema
(`z.infer`), então schema e tipo não podem divergir — e o mapa `JobSchemas` é
mapeado sobre os handlers: **esquecer um schema é erro de compilação**.

A validação acontece nas duas pontas, e cada uma pega um problema diferente:

- **No `enqueue`** — falha no produtor, onde o stack trace aponta para quem
  errou, em vez de horas depois dentro do worker.
- **Na entrada do worker** — o payload atravessou processo *e tempo*: um job
  enfileirado ontem pode ser consumido por um worker que subiu hoje, com outra
  versão do código. Payload que não bate com o schema atual vira
  `UnrecoverableError` e vai direto para a DLQ, sem queimar as tentativas
  restantes — retry não conserta payload malformado.

> O tipo garante a **forma** do payload; o schema garante o **conteúdo**. Um
> `to: 'nao-e-email'` é uma `string` perfeitamente bem tipada.

### Dead-letter queue

Job que esgota as tentativas (ou falha de forma irrecuperável) é registrado numa
fila dedicada, `<fila>-dlq`, com o payload original, a mensagem do erro e o
número de tentativas. Nada consome dessa fila — ela é o **registro durável** do
que falhou de vez.

```ts
await jobs.listDeadLetters()      // inspecionar
await jobs.replayDeadLetters()    // devolver para a fila principal
```

O `replay` revalida o payload contra o schema atual: se a DLQ guardou algo que o
contrato de hoje recusa, o replay para ali em vez de reenfileirar lixo.

As falhas recentes também continuam na fila principal (`removeOnFail: 5000`), que
é o que dá o botão **Retry** nativo do Bull Board.

### Bull Board (inspeção das filas)

Painel em **`/admin/queues`** — jobs ativos, falhos, agendados e a DLQ.

Protegido pela **role de plataforma** (`admin`, do plugin admin do Better Auth):
a mesma que guarda o `/admin` no front. O painel expõe payloads de jobs — e-mails,
corpos de webhook, ids de usuário — então precisa do mesmo nível de proteção do
resto da área administrativa, e não de uma senha básica paralela que ninguém
rotaciona. Quem não é admin recebe **404**, não 403: o painel não confirma a
própria existência para quem não deveria alcançá-lo.

Só é montado quando há `REDIS_URL`. Para virar admin, use `ADMIN_EMAILS`.

### Graceful shutdown

`jobs.stop()` fecha o worker sem `force`, então o BullMQ **espera o job em
andamento terminar**. O teto de tempo é o `JOBS_SHUTDOWN_TIMEOUT_MS` (default
30s) — ajuste-o abaixo do limite do seu orquestrador (no Kubernetes, o padrão de
`terminationGracePeriodSeconds` é 30s).

> Cuidado ao mexer: o `delay` do `close-with-grace` é o orçamento **total** até o
> kill forçado, não uma folga depois do handler.

**O que já existe:**

- Job **`email`** — despacha **todos** os e-mails (verificação, reset, convite,
  billing) via `@repo/emails`. Os hooks do Better Auth e o billing chamam
  `enqueue('email', { template, … })` — com Redis, todo envio ganha retries.
  Sem `RESEND_API_KEY`, o `@repo/emails` loga em vez de enviar (adapter de dev),
  então o job funciona ponta a ponta sem provedor configurado.
- Jobs **`subscription-webhook`** e **`billing-webhook`** — a rota
  `POST /payments/webhook` valida o HMAC e enfileira **todo** evento: os
  `subscription.*` no primeiro e a **cobrança avulsa** (`billing.*` / PIX) no
  segundo. O processamento (status, histórico, e-mail) roda no worker, **async +
  idempotente** — o `jobId` deriva do evento/cobrança (`wh_<event>_<id>`), dedup
  contra reentregas do webhook. Sem Redis, roda inline (igual antes).
- Job agendado **`sweep-subscriptions`** — todo dia às 03:00, expira assinaturas
  pagas com `currentPeriodEnd` vencido (renovação não chegou).
- Job agendado **`sweep-trials`** — todo dia às 03:30, expira trials terminados
  (`status=TRIALING` + `trialEndsAt` no passado) sem conversão. O gating já trata
  o trial como expirado em tempo real (via `trialEndsAt`); este job mantém o
  estado coerente no banco.

**Adicionar uma fila / job novo:**

1. **Schema** — declare o contrato do payload em `apps/api/src/jobs/schemas.ts`
   e exporte o tipo (`z.infer`). Sem payload? Use `noPayloadSchema`.
2. **Handler** — crie em `apps/api/src/jobs/handlers.ts` tipando o parâmetro com
   o tipo do schema. A chave do mapa vira o nome do job.
3. **Registro** — adicione o schema ao mapa `schemas` em
   `apps/api/src/jobs/index.ts`. Se esquecer, o TypeScript reclama.
4. **Dispare** com `enqueue('meu-job', payload)` de qualquer lugar da API.
   Para deduplicar, passe `{ jobId }` — o mesmo `jobId` não entra duas vezes.
5. **Agendado?** Adicione `{ job: 'meu-job', pattern: '<cron>' }` em `schedules`.
6. **Fila separada?** Um `createJobRunner` com outro `queueName` — útil quando um
   job pesado não pode competir por worker com os rápidos. Cada runner tem a sua
   DLQ (`<fila>-dlq`) e aparece no Bull Board.

**Worker dedicado (produção):** para escalar, rode o worker num processo separado
com `pnpm worker` (`node dist/worker.js` em prod) e setando `JOBS_IN_PROCESS=false`
na API — assim a API só enfileira e o worker processa. Ele vive em
`apps/api/src/worker.ts` (entrypoint, não app separado) porque os handlers usam
os serviços da API; em produção é a mesma imagem com outro comando, e as réplicas
escalam de forma independente.

## MinIO / S3 (uploads de arquivos)

Upload de arquivos (#14) via **URL pré-assinada**: o servidor só assina; o
arquivo vai **direto** do browser pro S3 (não passa pela API). Já implementado no
módulo `apps/api/src/modules/storage` + `AvatarUpload` no front. **Opt-in**: sem
S3 configurado, a rota responde **503**.

**Ativar:**

1. **docker-compose.yml** — descomente os serviços `minio`/`minio-init` e o
   volume `minio:` (dev local). Console em `http://localhost:9001`.
2. **.env** — preencha `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` e, p/ MinIO/
   R2, `S3_ENDPOINT` + `S3_PUBLIC_URL` (base pública dos objetos). `S3_REGION`
   default `auto`. `AVATAR_MAX_BYTES` limita o avatar (default 2 MB).
3. Pronto — `POST /uploads/avatar` passa a assinar uploads.

**Como funciona:**

- **`StorageService.presignAvatar`** usa `createPresignedPost`
  (`@aws-sdk/s3-presigned-post`): a policy força o `Content-Type` e o
  `content-length-range` — **valida tipo e tamanho no storage**, não só no
  client. `forcePathStyle` liga automaticamente quando há `S3_ENDPOINT` (MinIO).
- **Fluxo no front (`/account`):** pede o presign → `POST` multipart direto pro
  bucket → salva a URL pública em `user.image` (`authClient.updateUser`).
- **Tipos aceitos (avatar):** PNG, JPEG, WEBP, GIF (edite em `storage/service.ts`).

**Estender para outros uploads:** replique `presignAvatar` com outro prefixo de
chave e suas próprias `Conditions`; exponha uma rota nova e consuma igual.

---

## Google OAuth (login social)

O botão "Continuar com Google" já existe no app; só falta as credenciais.

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   crie um **OAuth Client ID** (tipo *Web application*).
2. Em *Authorized redirect URIs*, adicione:
   `http://localhost:3333/auth/callback/google` (e a URL de produção).
3. **.env** — preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
4. Reinicie a API. Nenhuma mudança de código é necessária.

---

## E-mail transacional (Resend + React Email)

Já vem implementado no pacote **`@repo/emails`** (templates React Email +
helper de envio via Resend) e fiado nos fluxos de auth/org/billing.

**Ativar (produção):**

1. **.env** — preencha `RESEND_API_KEY` e `EMAIL_FROM` (use um remetente de
   **domínio verificado** no Resend).
2. Pronto. Sem a key, os e-mails são **logados no console** (dev) em vez de
   enviados — `@repo/emails` cai nesse fallback automaticamente.

**O que já dispara e-mail:**

- **Verificação de e-mail** no signup (`emailVerification.sendOnSignUp`; não
  bloqueia login — ligue `requireEmailVerification` se quiser exigir). O
  `callbackURL` é reescrito para o app (`APP_URL/dashboard`) após verificar.
- **Reset de senha por código (OTP)** — plugin `emailOTP` (server) +
  `emailOTPClient` (client), em vez de link (mais portável p/ app mobile, sem
  deep link). Fluxo no app: "esqueci a senha" no login → `/forgot-password`
  (passo 1: e-mail → `emailOtp.requestPasswordReset`; passo 2: código + nova
  senha → `emailOtp.resetPassword`). Código de 6 dígitos, expira em 5 min, 3
  tentativas (defaults). `revokeSessionsOnPasswordReset` ligado. Não há migration
  (o OTP usa a tabela `verifications` já existente).
- **Convite de organização** (`organization.sendInvitationEmail`).
- **Billing**: ativação e cancelamento de assinatura → e-mail ao owner da org
  (no webhook do `SubscriptionService`).

**Templates e preview:**

- Templates em `packages/emails/src/emails/*.tsx` (verificação, reset,
  convite, assinatura, notificação) + casca compartilhada `_layout.tsx`.
- Preview visual: `pnpm email:dev` (servidor do React Email).
- Para um novo e-mail: crie o template e exporte um sender em
  `packages/emails/src/index.tsx`.

**Multi-idioma (i18n):**

- Os textos dos e-mails vivem no namespace `email` do `@repo/i18n` (pt-BR / en /
  es). Cada template e sender recebe um `locale?` e traduz via `emailT(locale)`
  (`packages/emails/src/i18n.ts`) — assunto incluso. Idioma ausente/inválido cai
  no fallback (pt-BR).
- O `locale` viaja no job `email` (`{ locale?: string }`). As hooks do Better
  Auth (verificação, reset, convite) resolvem o idioma do **Accept-Language** do
  request (`localeFrom`); a notificação usa o `request.lang`. Webhooks de billing
  (sem request) caem no fallback.
- Para um novo idioma: adicione o locale em `@repo/i18n` (já cobre o `email`).

---

## Plugins do Better Auth (admin, organization, 2FA)

O boilerplate usa só email/senha + Google. Para multi-tenant, RBAC ou 2FA,
adicione os plugins em `better-auth/configs.ts` (server) e `auth-client.ts`
(client), depois rode `pnpm auth:generate` para atualizar o schema do Prisma e
`pnpm db:migrate`. Consulte as skills em `.claude/skills/*-best-practices`.

---

## AbacatePay (pagamentos — PIX e cartão)

Já vem com um módulo de pagamento (`apps/api/src/modules/payment`) que envolve o
SDK oficial `abacatepay-nodejs-sdk`. As rotas existem sempre (para o Kubb gerar
os hooks), mas só ficam ativas quando a API key está presente — sem a key, elas
respondem `503`. Para habilitar:

1. **.env** — preencha `ABACATEPAY_API_KEY` (use a key de _devMode_ para testes)
   e `ABACATEPAY_WEBHOOK_SECRET` (o segredo que você define no painel).
2. Reinicie a API. Sem mudança de código, os endpoints passam a funcionar:
   - `POST /payments/pix` — **checkout transparente PIX**: cria o QR Code e o
     copia-e-cola (`brCode`/`brCodeBase64`) para você renderizar na sua UI.
   - `POST /payments/checkout` — checkout hospedado (PIX + cartão); devolve a
     `url` de pagamento do AbacatePay.
   - `GET /payments/:id` — status da cobrança (reconsulta PIX pendente).
   - `POST /payments/webhook` — público; valida `?webhookSecret=...` e atualiza
     o status local. Cadastre `https://SEU_HOST/payments/webhook?webhookSecret=...`
     no painel do AbacatePay. **A fonte da verdade do pagamento é o webhook.**
3. **Frontend** — página de exemplo em `apps/app/src/routes/_app/billing.tsx`
   (link no dashboard) usando os hooks gerados `usePostPaymentsPix` e
   `useGetPaymentsId`.

**Persistência:** o model `Payments` (em `packages/database`) espelha as cobranças
localmente. Fica fora do escopo do `pnpm auth:generate` (sem relação formal com
`Users`, só uma coluna `userId` indexada), então o CLI do Better Auth não o
remove ao regenerar o schema.

**Limitação conhecida:** o SDK 1.6.0 não expõe o _checkout transparente de
cartão_ (`POST /transparents/create` da API). O fluxo de cartão aqui passa pelo
checkout hospedado (`billing.create`, retorna `url`). Para cartão 100%
transparente na sua própria UI, chame esse endpoint cru direto e estenda o
`PaymentService` — o ponto de extensão está pronto.

Ao mudar/adicionar rota de pagamento, rode `pnpm openapi && pnpm api-client`
para regenerar os hooks.

---

## Assinaturas / planos SaaS (AbacatePay v2)

Modelo de assinatura recorrente com **planos**, **estado da assinatura** ("tem
plano ativo?") e **histórico de pagamentos**. O domínio é gateway-agnóstico
(`Plans` → `Subscriptions` → `Payments`); a integração usa a **API v2 de
assinaturas** do AbacatePay (auto-cobrança nativa).

### Modelos (`packages/database`)

- **`Plans`** — catálogo. Cada plano mapeia para um **produto no AbacatePay**
  criado com um `cycle` (WEEKLY/MONTHLY/SEMIANNUALLY/ANNUALLY). Guarde o id do
  produto (`prod_...`) em `externalProductId`.
- **`Subscriptions`** — `ownerId` + `ownerType` (`USER` hoje; pronto para
  `ORGANIZATION`), `planId`, `status` (INCOMPLETE/TRIALING/ACTIVE/PAST_DUE/
  CANCELLED/EXPIRED), `currentPeriodEnd`, etc. Sem relação formal com `Users`
  (sobrevive ao `auth:generate`).
- **`Payments`** — ganhou `subscriptionId`; cobranças recorrentes entram aqui
  com `kind = "SUBSCRIPTION"`.

### Setup

1. **Planos** — `pnpm db:seed` cria 3 planos de exemplo (`starter`,
   `pro-monthly`, `pro-annual`). Edite `packages/database/prisma/seed.ts`.
2. **Produtos no AbacatePay** — crie um produto com `cycle` por plano pago e
   coloque o `prod_...` em `Plans.externalProductId` (sem ele, `POST
   /subscription` responde 503 `plan_not_linked`).
3. **Webhook** — o mesmo endpoint `POST /payments/webhook` despacha os eventos
   `subscription.{trial_started,completed,renewed,cancelled}` para o
   `SubscriptionService`, que dirige o estado e registra o histórico.

### Segurança do webhook

O endpoint aceita a chamada se **a assinatura HMAC for válida OU o segredo da
query bater** (configure ao menos um; sem nenhum, responde 401):

- **`X-Webhook-Signature` (HMAC-SHA256, base64 do corpo RAW)** — garante
  integridade. A chave pública padrão do AbacatePay já vem embutida; sobrescreva
  com `ABACATEPAY_WEBHOOK_PUBLIC_KEY` se ela for rotacionada. A validação usa
  `crypto.timingSafeEqual` e o **corpo cru** (capturado em `request.rawBody` por
  um content-type parser em `plugin.ts` — re-serializar quebraria o HMAC).
- **`?webhookSecret=...` (`ABACATEPAY_WEBHOOK_SECRET`)** — âncora de
  autenticidade (só você e o AbacatePay conhecem).

### Endpoints (tag `Subscription` / `Payment`)

- `GET /plans` — catálogo de planos.
- `GET /subscription` — assinatura atual + `isActive` (= tem plano pago).
- `POST /subscription` `{ planSlug }` — assina; devolve a `url` de checkout.
- `POST /subscription/cancel` — cancela (efeito imediato).
- `GET /payments` — histórico de pagamentos do usuário.

Frontend de exemplo em `apps/app/src/routes/_app/subscription.tsx` (planos,
plano atual, cancelar e histórico) usando os hooks gerados (`useGetPlans`,
`useGetSubscription`, `usePostSubscription`, `useGetPayments`).

### Bloqueio de features por plano

Controlado por **uma única config**: `REQUIRE_ACTIVE_PLAN` (env do backend).
`false` (default) = nada é bloqueado; `true` = features guardadas exigem plano
ativo. O backend é a fonte da verdade e expõe o estado em `gatingEnabled`
(no `GET /subscription`), que o front consome.

- **Servidor (barreira real):** `requireActivePlan` — um `preHandler` em
  `apps/api/src/modules/subscription/guard.ts`. Sempre exige login (401); com
  gating ligado e sem plano ativo, responde **402**. Use em qualquer rota:
  ```ts
  scope.get('/premium', { preHandler: requireActivePlan, schema }, handler)
  ```
  Rota de exemplo: `GET /premium`.
- **Front (só UX):** o layout pathless `apps/app/src/routes/_app/_paid.tsx`.
  Qualquer rota em `_app/_paid/*` herda o guard: se `gatingEnabled && !isActive`,
  redireciona para `/subscription`. Exemplo: `_app/_paid/premium.tsx`.

> O guard do front é conveniência; **nunca** confie nele para segurança — a
> proteção real é o `requireActivePlan` no backend.

### Pontos de atenção

- **v2 fora do SDK:** o SDK 1.6.0 não expõe assinaturas, então a chamada é crua
  e fica isolada em `apps/api/src/modules/subscription/abacatepay-v2.ts`. Se a
  AbacatePay mudar o contrato, ajuste só esse arquivo.
- **Webhook seguro:** valida `X-Webhook-Signature` (HMAC-SHA256 do corpo raw,
  `timingSafeEqual`) OU o `?webhookSecret=` — ver "Segurança do webhook" acima.
- **"Plano ativo"** = `status` ACTIVE/TRIALING e `currentPeriodEnd` no futuro
  (`SubscriptionService.getActive`). Use isso para liberar features.

Ao mudar/adicionar rota, rode `pnpm openapi && pnpm api-client`.

---

## Bloquear merge sem CI verde (branch protection)

A CI (`.github/workflows/ci.yml`) já expõe um check único **`CHECK`** que só fica
verde se `quality` + `e2e` + `migrations` passarem. Falta só **exigir** esse
check para bloquear o merge — e é aqui que entra a pegadinha de plano.

> ⚠️ **Requer repo público OU plano pago.** Branch protection / rulesets em repo
> **privado** precisa de **GitHub Team** (organização) ou **Pro** (conta pessoal).
> Em repo **público** é grátis. No plano grátis + privado, a CI ainda roda e
> mostra ✓/✗ no PR, mas o GitHub não bloqueia o botão de merge.

Quando for ativar (repo público ou plano pago):

**Pela UI** — `Settings → Rules → Rulesets → New branch ruleset`:

1. **Enforcement status: Active** (não deixe em *Evaluate/Disabled*).
2. **Target branches:** `main`.
3. ✅ *Require a pull request before merging*.
4. ✅ *Require status checks to pass* → **Add checks** → **`CHECK`**.
5. (Opcional) ✅ *Require branches to be up to date before merging*.

**Ou via `gh`** (admin do repo):

```bash
echo '{"required_status_checks":{"strict":true,"contexts":["CHECK"]},"enforce_admins":true,"required_pull_request_reviews":null,"restrictions":null}' \
  | gh api -X PUT repos/<owner>/<repo>/branches/main/protection --input -
```

`enforce_admins: true` aplica a regra também a admins (sem isso, admin mergeia
mesmo com check vermelho). Adicionou/renomeou jobs depois? Não precisa mexer na
regra — ela exige só o `CHECK`, que agrega todos os jobs.

---

## Organizations / multi-tenancy

Multi-tenancy via plugin `organization` do Better Auth (com **teams**). O dono
dos recursos de billing passa a ser a **organização ativa** da sessão.

### Como funciona

- **Server:** plugin `organization({ teams })` em `better-auth/configs.ts`.
  **Client:** `organizationClient({ teams })` em `packages/utils/auth-client.ts`.
- **Models:** Organization, Member, Invitation, Team, TeamMember (ajustados ao
  padrão `@db.Uuid` do projeto). A sessão ganha `activeOrganizationId`.
- **Org ativa:** `getAuthSession()` (em `apps/api/src/utils/auth.ts`) expõe o
  `activeOrganizationId`. Endpoints de org são servidos pelo Better Auth em
  `/auth/organization/*` e consumidos no front via `authClient.organization.*`.
- **Billing por organização:** `subscribe`, `getActive`, `requireActivePlan` e o
  histórico de pagamentos operam sobre `ownerType=ORGANIZATION` + a org ativa.
  Sem org ativa, `POST /subscription` responde **400** (`noActiveOrg`).
- **Auto-criação:** `databaseHooks.user.create.after` cria uma org pessoal
  (owner) no signup; `session.create.before` define a org ativa no login. O
  layout `_app` ainda ativa a primeira org se nenhuma estiver ativa (cobre o
  race da sessão inicial do signup).
- **Frontend:** `OrgSwitcher` (trocar/criar org) no header; página
  `/organization` (membros + convites + **times**); rota `/accept-invitation/$id`.

### Convites

`sendInvitationEmail` envia o e-mail de convite via `@repo/emails` (com o link
`{APP_URL}/accept-invitation/{id}`). Sem `RESEND_API_KEY`, o link é logado no
console (dev) — a UI também mostra "copiar link" como alternativa. O convidado
precisa estar logado (mesmo e-mail) para aceitar.

### Atenção

- Endpoints mutantes do Better Auth exigem header `Origin` em `trustedOrigins`
  (CSRF) — o browser manda automático; testes via curl precisam de `-H Origin`.
- Ao rodar `pnpm auth:generate` de novo, o CLI reintroduz relações duplicadas
  (`sessionss`/`accountss`) e remove o `@db.Uuid` dos models de org — limpe o
  diff (mantenha só as back-relations novas e reaplique `@db.Uuid`).
- Roles: `owner`/`admin`/`member` (permissões checadas no server). Para roles
  customizadas/teams avançados, veja a skill `organization-best-practices`.

---

## RBAC + painel admin (plugin admin)

RBAC de **plataforma** via plugin `admin` do Better Auth: uma role de **sistema**
(`admin` | `user`) por usuário, ban e impersonation — distinta dos papéis por
organização (`owner`/`admin`/`member`, que valem dentro de cada tenant).

### Como funciona

- **Server:** plugin `admin({ defaultRole, adminRoles, impersonationSessionDuration })`
  em `better-auth/configs.ts`. **Client:** `adminClient()` em
  `packages/utils/auth-client.ts`.
- **Schema:** o plugin adiciona `role`, `banned`, `banReason`, `banExpires` em
  `users` e `impersonatedBy` em `sessions` (migration `admin_plugin_rbac`).
- **Endpoints:** servidos pelo Better Auth em `/auth/admin/*` (list-users,
  set-role, ban-user, unban-user, impersonate-user, stop-impersonating,
  revoke-user-sessions, remove-user…) e consumidos no front via
  `authClient.admin.*`. Não há módulo de API próprio nem hooks do Kubb.
- **Frontend:** área `/admin` (`apps/app/src/routes/_app/admin`) guardada pela
  role de sistema (quem não é `admin` é redirecionado). Página de gestão de
  usuários: busca, paginação, trocar role, ban/unban (motivo + expiração),
  impersonar, revogar sessões e remover. Link "Admin" no header (só admins) e
  banner global de impersonation (em `_app`) com "parar de impersonar".

### Primeiro admin (super-admin)

Defina `ADMIN_EMAILS` (lista separada por vírgula) no `.env`. Os hooks do Better
Auth promovem esses e-mails a `role='admin'` — no signup e, para contas já
existentes, no próximo login (idempotente). Vazio = nenhum admin automático
(promova manualmente pelo banco ou por outro admin já existente).

### Atenção

- A barreira real é o **servidor** (cada endpoint exige a role/permissão); o
  guard de rota no front é só UX.
- Não dá pra banir/remover/impersonar a própria conta pela UI (botões
  desabilitados); o servidor também recusa casos inválidos.
- Permissões finas (além de `admin`/`user`) podem ser modeladas com
  `ac`/`roles` próprios do plugin admin — veja a skill
  `better-auth-best-practices`.

---

## Entitlements / limites por plano

Transforma `plan.features` (ex.: `{ seats: 5, projects: 20, apiCalls: 100000 }`)
em regras de uso por **organização** — o que dá sentido prático aos planos além
do gate "tem plano?". Módulo `apps/api/src/modules/entitlements`.

### Como funciona

- **Features:** mapa `{ <metric>: number | boolean }` no `plan.features`.
  Métricas numéricas viram **quotas**; flags booleanas viram features
  liga/desliga (`canUseFeature`). Limite ausente = ilimitado; `-1` = ilimitado
  explícito; `0` desliga a feature.
- **`EntitlementsService`:** resolve as features do plano ativo da org (fallback
  no plano free `starter` quando não há assinatura ativa) e expõe `getUsage`,
  `checkQuota`, `consume` (incremento atômico dentro da quota) e `canUseFeature`.
- **Dois tipos de métrica:**
  - **contagem viva** (ex.: `seats`) — contada direto na fonte (`Member`), sempre
    exata, sem contador;
  - **medida** (ex.: `apiCalls`) — acumulada na tabela `usage_counters` por
    período. O período é uma **chave mensal** (`YYYY-MM`): virar o mês cria uma
    linha nova — **reset implícito**, sem job de reset.
- **Endpoints (tag `Entitlements`):** `GET /entitlements` (resumo de uso da org
  ativa) e `POST /entitlements/track` (consome uma métrica medida; **402** ao
  exceder). Hooks gerados pelo Kubb (`useGetEntitlements`,
  `usePostEntitlementsTrack`).
- **Guard:** `requireQuota(metric)` (preHandler) bloqueia ações que criam
  recursos limitados (ex.: antes de adicionar membro) com **402**.
- **Front:** card "Uso do plano" em `/subscription` (uso/limite por métrica +
  barra) com um botão de demo que consome 1 unidade.

### Atenção

- A trava real é no **servidor** (`consume`/`requireQuota`); a UI é só leitura.
- Enforçar `seats` no convite exige um hook no fluxo do plugin organization
  (`/auth/organization/*`) — fica como opt-in; o `checkQuota('seats')`/
  `requireQuota('seats')` já estão prontos para isso.
- Para amarrar o período de uso ao ciclo de cobrança (em vez do mês calendário),
  troque a chave de período por `currentPeriodStart` da assinatura.

---

## Audit log (trilha de auditoria)

Trilha de ações sensíveis por **organização** (mudou role, removeu membro,
cancelou assinatura…). Módulo `apps/api/src/modules/audit` + model `AuditLogs`.

### Como funciona

- **Model `AuditLogs`** (`audit_logs`): `{ actorId, action, organizationId,
  targetType, targetId, metadata, ip, userAgent, createdAt }`. Sem relação
  formal (mesma nota dos modelos da app). Migration `audit_logs`.
- **`AuditService.record(entry)`** é **best-effort**: roda num `try/catch` e
  nunca lança no caminho do request — falhar a auditoria não derruba a ação.
- **Duas fontes de eventos:**
  - **Nossos módulos:** o handler chama `audit.record(...)` (ex.: assinar/
    cancelar assinatura no `subscription/route.ts`), com IP/UA via `requestMeta`.
  - **Better Auth (`/auth/*`):** um hook `hooks.after` (`auditAfterHook`) audita
    as ações mutantes do plugin organization (remover membro, mudar role,
    convites, times…) — que não passam pelos nossos módulos. O mapa
    path→ação está em `audit/actions.ts` (`AUDIT_ORG_PATHS`).
- **`GET /audit`** devolve a trilha da organização ativa (mais recentes
  primeiro). Front: página `/audit` (link no header do dashboard).

### Adicionar uma ação à trilha

- **Ação no seu código:** `await app.services.audit.record({ action: 'x.y',
  actorId, organizationId, targetType, targetId, metadata, ...requestMeta(request) })`.
- **Ação do Better Auth:** adicione o path em `AUDIT_ORG_PATHS`
  (`audit/actions.ts`). Para ações de `/admin/*` (role de plataforma/ban),
  estenda o mapa/hook de forma análoga.

### Atenção

- A trilha é **org-scoped**: ações de plataforma (`/admin/*`, sem organização)
  não aparecem no `GET /audit` por padrão — adicione um escopo de plataforma
  para super-admins se precisar.
- Em produção com Redis, dá para registrar via fila (#5) para desacoplar a
  escrita do request — hoje a escrita é direta e best-effort.

---

## Observabilidade (Pino + Sentry)

Log estruturado, correlação entre log e rastro, captura de erros e probes de
saúde. Segue a filosofia do boilerplate: **funciona sem infra** — sem DSN, o
Sentry é no-op; o log continua funcionando sempre.

### Log (Pino)

O Pino já é o logger nativo do Fastify, então ele é **configurado**, não
substituído. A config vive em `apps/api/src/utils/logger.ts` e é compartilhada
com o worker — dois formatos de log obrigam o agregador a ter dois parsers, e
metade dos campos acaba não indexada.

- **JSON estruturado** por padrão; `pino-pretty` **só em desenvolvimento** (ele
  custa CPU e destrói o parsing de quem consome).
- **Redaction obrigatória.** `authorization`, `cookie`, `set-cookie`,
  `x-api-key` e qualquer `password`/`token`/`secret`/`otp`/`keyHash`/`apiKey`
  em qualquer profundidade viram `[REDACTED]`.
  > Por que importa: log vai para um agregador de terceiros, fica meses retido e
  > é lido por gente que não precisaria daquele dado. Um `authorization` ali é
  > credencial válida em texto puro; o cookie de sessão permite personificar o
  > usuário — e não expira quando ele troca a senha.
  >
  > Adicionou um campo sensível ao domínio? Inclua em `REDACTED_PATHS`. O teste
  > `logger-redaction.test.ts` trava a lista.
- **`requestId`** em toda linha da request (`reqId`), gerado ou herdado do
  header `x-request-id`, e devolvido na resposta e no corpo dos erros.
- **`trace_id` do Sentry** em toda linha, quando há DSN — é o que liga o log ao
  evento no Sentry nos dois sentidos.
- **Worker:** mesmo formato e mesma redaction (antes era `console.info`, texto
  solto e sem proteção nenhuma, num processo que manipula payload de e-mail).
  Cada linha carrega `jobId` e `job`, então dá para reconstruir um job
  específico no meio de N processados em paralelo.

### Sentry

**Ativar:** crie projetos no [Sentry](https://sentry.io) (um Node, um browser) e
preencha `SENTRY_DSN` / `VITE_SENTRY_DSN`. Sem DSN, nada inicializa.

- **API/worker:** `@sentry/node` v10, baseado em OpenTelemetry — auto-instrumenta
  Fastify, Prisma e HTTP, cobrindo traces distribuídos sem SDK separado. Init em
  `instrument.ts` (1º import; em produção via `node --import`).
- **App:** `@sentry/react` + `browserTracingIntegration` + `ObservabilityBoundary`.
- **`beforeSend` filtra antes de enviar.** Headers, cookies e query string são
  limpos; qualquer chave que pareça senha/token/segredo vira `[REDACTED]`,
  recursivamente. O `sendDefaultPii: false` cobre o óbvio, mas não o que a
  aplicação anexa em `extra` — o corpo de um webhook, por exemplo. No front, os
  query params sensíveis da URL também são mascarados.
- **Contexto de usuário:** só o `id`, nos dois lados. E-mail e nome são dados
  pessoais sem contrapartida num relatório de erro; o id já responde "quantos
  usuários isso atingiu".
- **Release tracking:** `SENTRY_RELEASE` / `VITE_SENTRY_RELEASE`. Injete o SHA
  do commit no deploy — vazio, tudo cai numa release só e some a informação de
  qual deploy quebrou.
- **Amostragem:** `SENTRY_TRACES_SAMPLE_RATE` (0..1, default 0 = só erros).

### Source maps

Gerados nos dois builds: `sourceMap: true` no `tsc` da API (com
`--enable-source-maps` no `start`) e `sourcemap: 'hidden'` no Vite.

`hidden` significa que os `.map` existem mas **não** são referenciados pelo
bundle — o Sentry desminifica após o upload, e o código-fonte não fica servido
para quem abrir o devtools. A imagem do app apaga os `.map` antes de servir.

O upload é passo de deploy, com o CLI oficial e sem dependência no repositório:

```bash
npx @sentry/cli sourcemaps inject --org SUA_ORG --project SEU_PROJ dist
npx @sentry/cli sourcemaps upload --org SUA_ORG --project SEU_PROJ \
  --release "$VITE_SENTRY_RELEASE" dist
```

> Optamos por não adicionar `@sentry/vite-plugin`: ele seria no-op para quem não
> usa Sentry e exigiria um token de auth em build time. Se você usa Sentry a
> sério e quer o upload automático no build, o plugin é a escolha certa —
> instale-o e configure com a mesma release.

### Health e readiness

Duas rotas, porque orquestradores fazem duas perguntas diferentes:

- **`/health` (liveness)** — "o processo está são?" Responder mal faz o
  orquestrador **reiniciar** o container. Não toca em dependência nenhuma, de
  propósito.
- **`/ready` (readiness)** — "posso receber tráfego?" Verifica Postgres e (se
  configurado) Redis. Responder mal só **tira do balanceador**.

Misturar as duas é o erro comum, e o sintoma é caro: uma queda de banco de 30
segundos vira uma frota inteira em crash loop — e reiniciar não traz banco de
volta. O `HEALTHCHECK` do Docker usa `/ready`, porque é ele que libera os
serviços dependentes (`depends_on: service_healthy`).

**Testar o Sentry:** em dev, `GET /debug/sentry` lança um erro de propósito.

## API keys (acesso programático)

Chaves de API para clientes/integrações chamarem a API, com escopo por
**organização**. Módulo `apps/api/src/modules/api-keys`.

> **Nota:** o plugin `apiKey` do Better Auth **não existe** na versão usada
> (1.6.x) nem na 1.7-beta — por isso é um módulo próprio, no padrão dos demais.

### Como funciona

- **Token:** formato `bk_<segredo>`. Só o token completo dá acesso; guardamos
  apenas o **hash SHA-256** e um **prefixo visível** (`bk_a1b2c3d4`) para lookup/
  UI. O token é exibido **uma única vez** na criação.
- **Model `ApiKeys`** (`api_keys`): `organizationId` (escopo), `userId` (criador),
  `scopes` (Json — permissões; null = sem restrição além da org), `expiresAt`,
  `lastUsedAt`, `revokedAt`. Migration `api_keys`.
- **`ApiKeyService`:** `create` (gera/hasheia), `list`, `revoke`, `verify`
  (lookup por prefixo → compara hash em tempo constante → checa expiração/
  revogação → marca `lastUsedAt`).
- **Gestão (sessão):** `GET /api-keys`, `POST /api-keys`, `DELETE /api-keys/:id`
  (tag `ApiKeys`). Criar/revogar exige **owner/admin** da org. Integra com a
  auditoria (#8): registra `api_key.create` / `api_key.revoke`.
- **Acesso programático:** `requireApiKey(scope?)` (preHandler) lê
  `Authorization: Bearer bk_…` ou `x-api-key`, valida e anexa `request.apiKey`
  (`{ organizationId, userId, scopes }`). Exemplo: `GET /v1/ping`.
- **Scalar/OpenAPI:** rotas com API key declaram `security: [{ Bearer: [] }]`
  (o esquema `Bearer` já existe no Swagger) — aparecem autenticáveis no
  `/reference`.
- **Front:** página `/api-keys` (criar com token exibido 1x + copiar; listar;
  revogar). Link no header do dashboard.

### Proteger uma rota com API key

```ts
scope.get('/v1/things', { preHandler: requireApiKey('things:read'), schema }, h)
// request.apiKey.organizationId escopa a query
```

### Atenção

- A chave dá acesso no escopo da organização; trate o token como segredo (só o
  hash é persistido — não há como recuperá-lo, apenas revogar e recriar).
- `scopes` é livre por padrão; para escopos finos, valide strings de permissão
  no `requireQuota`-style e documente o catálogo.
- Não há rate-limit por chave embutido — combine com Redis (`UPGRADES.md` →
  Redis) se precisar.

---

## LGPD/GDPR (export + exclusão)

Direitos do titular: **exportar** os dados pessoais e **excluir** a conta.
Relevante no Brasil (LGPD) e na UE (GDPR).

### Export

- `GET /me/export` (`MeService.exportUserData`) compila os dados pessoais do
  usuário num JSON para **download** (rota `hide: true` — é um arquivo, não entra
  no OpenAPI/Kubb). O front (`/account`) faz `fetch` com credenciais e salva.
- **Sanitização:** nunca inclui senha, tokens de OAuth, token de sessão nem o
  hash das API keys. Inclui: perfil, contas/sessões (sanitizadas), organizações,
  API keys (sem hash) e a trilha de auditoria do usuário.
- **Escala:** para volumes grandes, troque o export síncrono por um job (#5) que
  gera o arquivo no S3 (#14) e envia o link por e-mail.

### Exclusão de conta

- `user.deleteUser` do Better Auth, ligado em `configs.ts`. Sem
  `sendDeleteAccountVerification`, exige **reautenticação por senha** — o front
  (`/account`) coleta a senha e chama `authClient.deleteUser({ password })`.
- O callback **`afterDelete`** limpa o que não cai por FK: apaga as API keys do
  usuário e **anonimiza** os audit logs (`actorId → null`, preservando o evento).
  Member/sessions/accounts/invitations caem por cascade (FK → `users`).

### Atenção

- **OAuth-only** (sem senha): habilite `sendDeleteAccountVerification` para
  exclusão por link de e-mail.
- A org **não** é apagada com o usuário (billing/membros seguem). Se o usuário é
  o único owner, decida a política (transferir/encerrar) antes de liberar em
  produção.
- O export expõe dados pessoais — sirva sempre sobre sessão autenticada (já é o
  caso) e por HTTPS.

---

## Notificações in-app + preferências

Centro de notificações por usuário + preferências de canal por categoria.
Módulo `apps/api/src/modules/notifications`.

### Como funciona

- **Models:** `Notifications` (por usuário, com `category`, `readAt`) e
  `NotificationPreferences` (um Json por usuário: categoria → `{ email, inApp }`).
  Migration `notifications`.
- **`NotificationService.notify(userId, { category, title, body?, url? })`** é o
  **ponto de entrada** para outras features dispararem notificações. Respeita as
  preferências: se `inApp` ligado, cria o registro; se `email` ligado, **enfileira
  via #5** o template genérico `notification` do `@repo/emails`.
- **Categorias:** `system`, `billing`, `security`, `member` (default: tudo
  ligado). Edite a lista em `NOTIFICATION_CATEGORIES`.
- **Rotas (tag `Notifications`):** `GET /notifications` (lista + não lidas),
  `POST /notifications/:id/read`, `POST /notifications/read-all`,
  `GET|PUT /notifications/preferences`, `POST /notifications/test` (demo).
- **Front:** **sino** no header (badge de não lidas, via `useGetNotifications`) +
  página `/notifications` (lista com marcar como lida + grade de preferências).

### Disparar uma notificação

```ts
// de qualquer lugar da API (ex.: no webhook de billing):
await app.services.notifications.notify(userId, {
  category: 'billing',
  title: 'Pagamento confirmado',
  body: 'Recebemos seu pagamento.',
  url: '/billing',
})
```

### Atenção

- O front usa **polling** (React Query) para o badge; para realtime, troque por
  SSE/WebSocket.
- O e-mail só sai com `RESEND_API_KEY` (senão é logado — ver "E-mail
  transacional"); e respeita a preferência `email` da categoria.

---

## Product analytics + feature flags (PostHog)

Analytics de produto + **feature flags** + **session replay** num pacote só
(`posthog-js`), no front. **Opt-in**: sem `VITE_POSTHOG_KEY` é no-op.

**Ativar:**

1. Crie um projeto no [PostHog](https://posthog.com) e pegue a **Project API Key**.
2. **.env** — `VITE_POSTHOG_KEY` e (opcional) `VITE_POSTHOG_HOST`
   (`https://us.i.posthog.com` ou `https://eu.i.posthog.com`).
3. Pronto. Session replay liga/desliga no painel do projeto.

**Como funciona (`apps/app/src/analytics.ts`):**

- `initAnalytics()` em `main.tsx` inicializa o PostHog (no-op sem key).
- **Pageviews:** capturados manualmente a cada navegação resolvida do router
  (SPA) — `router.subscribe('onResolved', capturePageview)`.
- **Identidade:** `identifyUser(user)` no layout `_app` (quando há sessão) e
  `resetAnalytics()` no logout.
- **Eventos:** `captureEvent('nome', props)` de qualquer lugar do app.
- **Feature flags:** hook `useFeatureFlag('minha-flag')` (reativo; `false` sem
  analytics). Exemplo no dashboard: badge "Beta" via a flag `beta-banner`.

**Atenção:**

- `posthog-js` adiciona peso ao bundle; carregue sob demanda (dynamic import) se
  precisar.
- Para flags/eventos no **servidor** (ex.: gating de API), adicione
  `posthog-node` na API.
- Respeite consentimento/cookies do usuário conforme a sua política (LGPD/GDPR).
