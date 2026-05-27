# Guias de Upgrade

O boilerplate vem com o mínimo para funcionar (Postgres + Better Auth + OpenAPI).
Estes guias adicionam serviços comuns conforme o projeto cresce. Cada um é
independente — adicione só o que precisar.

---

## Redis (cache / sessão secundária / rate-limit distribuído)

Útil para acelerar a sessão do Better Auth (`secondaryStorage`), cache da
aplicação e rate-limit compartilhado entre instâncias.

1. **docker-compose.yml** — descomente o serviço `redis` e a entrada `redis:` em `volumes:`.
2. **.env** — descomente `REDIS_URL` e `REDIS_PORT`.
3. **apps/api** — instale o cliente e o storage:
   ```bash
   pnpm --filter @repo/api add ioredis @better-auth/redis-storage
   ```
4. **apps/api/src/utils/redis.ts** — crie o cliente:
   ```ts
   import { Redis } from 'ioredis'
   import { env } from '@/utils/environment.js'
   export const redis = new Redis(env.REDIS_URL)
   ```
5. **environment.ts** — adicione `REDIS_URL: z.string()` ao schema.
6. **better-auth/configs.ts** — ligue o storage secundário:
   ```ts
   import { redisStorage } from '@better-auth/redis-storage'
   import { redis } from '@/utils/redis.js'
   // dentro de createAuthConfig():
   secondaryStorage: redisStorage({ client: redis, keyPrefix: 'better-auth:' }),
   rateLimit: { storage: 'secondary-storage' },
   ```

---

## MinIO / S3 (uploads de arquivos)

Storage S3-compatível para uploads. MinIO roda local; em produção troque pelas
credenciais do seu provedor (AWS S3, Cloudflare R2, etc.).

1. **docker-compose.yml** — descomente os serviços `minio` e `minio-init` e a
   entrada `minio:` em `volumes:`.
2. **.env** — descomente o bloco `S3_*` e `MINIO_*`.
3. **apps/api** — instale o SDK e o multipart:
   ```bash
   pnpm --filter @repo/api add @aws-sdk/client-s3 @fastify/multipart
   ```
4. **environment.ts** — adicione `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
   `S3_BUCKET`, `S3_REGION`, `S3_PUBLIC_URL` ao schema.
5. **plugin.ts** — registre o multipart:
   ```ts
   import multipart from '@fastify/multipart'
   await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } })
   ```
6. Console do MinIO em `http://localhost:9001` (login = `S3_ACCESS_KEY` / `S3_SECRET_KEY`).

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

## Email transacional (Resend)

Para verificação de email, reset de senha e notificações.

1. ```bash
   pnpm --filter @repo/api add resend
   ```
2. **.env** — adicione `RESEND_API_KEY=...`.
3. **environment.ts** — adicione `RESEND_API_KEY: z.string()`.
4. **better-auth/configs.ts** — use os hooks de email do Better Auth
   (`emailAndPassword.sendResetPassword`, `emailVerification.sendVerificationEmail`).
   Veja a skill `.claude/skills/email-and-password-best-practices`.

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

Sem e-mail transacional ainda (ver Resend acima): `sendInvitationEmail` **loga**
o link de aceite (`{APP_URL}/accept-invitation/{id}`) e a UI mostra "copiar
link". Ao ligar o Resend, troque o corpo de `sendInvitationEmail` por um envio
real. O convidado precisa estar logado (mesmo e-mail) para aceitar.

### Atenção

- Endpoints mutantes do Better Auth exigem header `Origin` em `trustedOrigins`
  (CSRF) — o browser manda automático; testes via curl precisam de `-H Origin`.
- Ao rodar `pnpm auth:generate` de novo, o CLI reintroduz relações duplicadas
  (`sessionss`/`accountss`) e remove o `@db.Uuid` dos models de org — limpe o
  diff (mantenha só as back-relations novas e reaplique `@db.Uuid`).
- Roles: `owner`/`admin`/`member` (permissões checadas no server). Para roles
  customizadas/teams avançados, veja a skill `organization-best-practices`.
