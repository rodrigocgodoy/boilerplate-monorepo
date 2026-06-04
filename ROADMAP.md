# Roadmap de Features

Ideias priorizadas para evoluir este boilerplate de **monorepo SaaS**. Cada item
é independente — implemente só o que o seu produto precisar.

- Para **serviços de infra** já documentados (Redis, S3, Resend, OAuth, plugins
  do Better Auth), veja [`UPGRADES.md`](./UPGRADES.md).
- Padrão da API: módulo em `apps/api/src/modules/<x>` (`service.ts` + `route.ts`
  + `schemas.ts` com Zod) → OpenAPI → hooks do Kubb. Veja `modules/payment` e
  `modules/subscription` (na branch `feat/abacatepay-payments-subscriptions`)
  como referência.

**Legenda de esforço:** 🟢 P (1–2 dias) · 🟡 M (3–5 dias) · 🔴 G (1–2 semanas).
**🧩 skill** = já existe skill em `.claude/skills` cobrindo o assunto.

---

## Visão geral

| # | Feature | Tier | Esforço | Depende de |
|---|---------|------|---------|------------|
| 1 | Organizations / multi-tenancy | 1 | 🔴 G | — |
| 2 | E-mail transacional (Resend + React Email) ✅ | 1 | 🟡 M | — |
| 3 | Fundação de testes (Vitest + Playwright) | 1 | 🟡 M | — |
| 4 | CI/CD (GitHub Actions) | 1 | 🟢 P | #3 |
| 5 | Jobs em background (BullMQ + Redis) ✅ | 1 | 🟡 M | Redis |
| 6 | RBAC + painel admin ✅ | 2 | 🟡 M | #1 |
| 7 | Entitlements / limites por plano ✅ | 2 | 🟡 M | Assinaturas |
| 8 | Audit log ✅ | 2 | 🟢 P | — |
| 9 | Observabilidade (Sentry + OTel) ✅ | 2 | 🟡 M | — |
| 10 | API keys (acesso programático) ✅ | 2 | 🟢 P | #6 |
| 11 | LGPD/GDPR (export + exclusão de conta) ✅ | 3 | 🟡 M | #5 |
| 12 | 2FA / passkeys | 3 | 🟢 P | E-mail |
| 13 | Notificações in-app + preferências ✅ | 3 | 🟡 M | #5 |
| 14 | Upload de avatar/arquivos (S3) ✅ | 3 | 🟢 P | S3 |
| 15 | Product analytics + feature flags (PostHog) ✅ | 3 | 🟢 P | — |
| 16 | Storybook no `packages/ui` | 3 | 🟢 P | — |
| 17 | Dockerfile + deploy | 3 | 🟢 P | — |

**Top 3 pra dar o maior salto:** #1 Organizations, #2 E-mail, #3+#4 Testes+CI.

---

## 🥇 Tier 1 — fundação

### 1. Organizations / multi-tenancy 🔴 🧩 — ✅ FEITO

- **Status:** implementado. Ver `UPGRADES.md` → "Organizations / multi-tenancy".
- Plugin `organization` do Better Auth (com **teams**) no server +
  `organizationClient` no client; models Organization/Member/Invitation/Team/
  TeamMember (migration).
- **Billing migrado para a organização ativa** (`ownerType=ORGANIZATION`):
  `subscribe`/`getActive`/`requireActivePlan`/histórico operam sobre a org da
  sessão (`getAuthSession`).
- Frontend: `OrgSwitcher` (trocar/criar), página `/organization` (membros +
  convites por link), `/accept-invitation/$id`.
- **Convites por organização** enviados por e-mail via `@repo/emails` (#2); sem
  `RESEND_API_KEY`, o link é logado no console (dev) e a UI mostra "copiar link".

### 2. E-mail transacional (Resend + React Email) 🟡 🧩 — ✅ FEITO

- **Status:** implementado no pacote `@repo/emails`. Ver `UPGRADES.md` →
  "E-mail transacional (Resend + React Email)".
- Templates React Email (`packages/emails/src/emails/*.tsx`) + sender via Resend;
  sem `RESEND_API_KEY`, os e-mails são logados no console (fallback de dev).
  Preview com `pnpm email:dev`.
- **Dispara hoje:** verificação de e-mail no signup, reset de senha e convite de
  organização (hooks do Better Auth) + billing (ativação/cancelamento ao owner
  da org, no webhook do `SubscriptionService`).
- **Reset de senha por código (OTP)** no app: "esqueci a senha" no login →
  `/forgot-password` (e-mail → código → nova senha). Plugin `emailOTP` do Better
  Auth, sem link/deep link — amigável a app mobile.
- **Próximos passos:** e-mails de billing adicionais (pagamento falhou, trial
  acabando).

### 3. Fundação de testes (Vitest + Playwright) 🟡 — ✅ FEITO

- **Status:** implementado. Ver [`TESTING.md`](./TESTING.md).
- Vitest por package (API com `app.inject`; `@repo/ui` com jsdom), task `test`
  no Turbo (`pnpm test`) e E2E com Playwright (`pnpm test:e2e`).
- Já cobre: guards das rotas (503/400/401/402/403), HMAC do webhook, componente
  de UI, smoke E2E do login e **testes de integração com Postgres** (gated por
  `TEST_DATABASE_URL`): entitlements, audit, notifications, api-keys e export
  LGPD — rodam no CI a cada PR.
- **Próximos passos** (documentados no `TESTING.md`): E2E autenticado (login →
  checkout) e cobertura (`--coverage`).

### 4. CI/CD (GitHub Actions) 🟢 — ✅ FEITO

- **Status:** implementado em `.github/workflows/ci.yml` (3 jobs).
  - `quality`: lint (Biome) → build (typecheck + bundle via Turbo) → test (Vitest), com cache de pnpm e Turbo.
  - `e2e`: Playwright (gera o api-client, instala o Chromium, roda o smoke).
  - `migrations`: Postgres de serviço → `migrate deploy` + `status` + **drift check** (`migrate diff --exit-code`) + seed.
- Dispara em push na `main` e em PRs; badge no README.
- **Próximos passos:** `--affected` do Turbo (rodar só o que mudou) e remote cache.

### 5. Jobs em background (BullMQ + Redis) 🟡 — ✅ FEITO

- **Status:** implementado. Ver `UPGRADES.md` → "Jobs em background (BullMQ + Redis)".
- Pacote **`@repo/jobs`** (infra genérica de fila com BullMQ) + handlers em
  `apps/api/src/jobs`. **Funciona sem infra**: sem `REDIS_URL`, `enqueue` roda
  inline (dev); com Redis, fila real com retries/backoff + jobs agendados (cron).
- Jobs: **`email`** (todos os e-mails — verificação, reset, convite e billing —
  passam pela fila), **`subscription-webhook`** e **`billing-webhook`** (todos os
  eventos do webhook — assinatura e cobrança avulsa `billing.*`/PIX — processados
  fora do request, async + idempotente via `jobId`), **`sweep-subscriptions`**
  (diário 03:00, expira assinaturas pagas vencidas) e **`sweep-trials`** (diário
  03:30, expira trials terminados sem conversão; o gating já corta o acesso em
  tempo real via `trialEndsAt`).
- Worker in-process por padrão (`JOBS_IN_PROCESS`); `pnpm worker` para um worker
  dedicado em produção.
- **Próximos passos:** notificações de billing adicionais (pagamento falhou,
  trial acabando) e métricas/observabilidade da fila (#9).

---

## 🥈 Tier 2 — diferenciais de SaaS

### 6. RBAC + painel admin 🟡 🧩 — ✅ FEITO

- **Status:** implementado. Ver `UPGRADES.md` → "RBAC + painel admin (plugin
  admin)".
- Plugin `admin` do Better Auth no server + `adminClient` no client. Role de
  **sistema** (`admin`/`user`), ban e impersonation — distinta dos papéis por
  organização (#1). Migration `admin_plugin_rbac` (`role`/`banned`/`banReason`/
  `banExpires` em `users`, `impersonatedBy` em `sessions`).
- Painel `/admin` (`_app/admin`) guardado pela role de sistema: gestão de
  usuários (busca/paginação), trocar role, ban/unban (motivo + expiração),
  impersonar, revogar sessões e remover. Banner global de impersonation.
- **Primeiro admin** via `ADMIN_EMAILS` (promovido no signup e sincronizado no
  login). Endpoints sob `/auth/admin/*` (sem módulo de API/Kubb próprio).
- **Próximos passos:** permissões finas (`ac`/`roles` do plugin) e E2E
  autenticado do painel (depende do banco de teste — ver `TESTING.md`).

### 7. Entitlements / limites por plano 🟡 — ✅ FEITO

- **Status:** implementado. Ver `UPGRADES.md` → "Entitlements / limites por plano".
- Módulo `entitlements`: `EntitlementsService` (`getUsage`/`checkQuota`/`consume`/
  `canUseFeature`) transforma `plan.features` em quotas por organização (fallback
  no plano free quando sem assinatura ativa). Núcleo puro testável (`quota.ts`).
- Métricas de **contagem viva** (`seats` → `Member`) e **medidas** (`apiCalls` →
  tabela `usage_counters`, período mensal `YYYY-MM` com reset implícito).
- Endpoints `GET /entitlements` e `POST /entitlements/track` (402 ao exceder) +
  guard `requireQuota(metric)`. Front: card "Uso do plano" em `/subscription`.
- **Próximos passos:** enforçar `seats` no convite (hook do plugin organization)
  e amarrar o período ao ciclo de cobrança; pricing usage-based.

### 8. Audit log 🟢 — ✅ FEITO

- **Status:** implementado. Ver `UPGRADES.md` → "Audit log (trilha de auditoria)".
- Model `AuditLogs` + `AuditService.record` (**best-effort**, nunca quebra a
  ação) + `requestMeta` (IP/UA). Migration `audit_logs`.
- Duas fontes: ações dos nossos módulos (assinar/cancelar assinatura) e um hook
  `hooks.after` do Better Auth que audita as mutações do plugin organization
  (remover membro, mudar role, convites, times) via `AUDIT_ORG_PATHS`.
- `GET /audit` (org-scoped) + página `/audit` no app (link no dashboard).
- **Próximos passos:** escopo de plataforma para ações `/admin/*` (role/ban) e,
  com Redis, registrar via fila (#5) para desacoplar a escrita do request.

### 9. Observabilidade (Sentry + OpenTelemetry) 🟡 — ✅ FEITO

- **Status:** implementado. Ver `UPGRADES.md` → "Observabilidade (Sentry)".
- **Opt-in:** sem `SENTRY_DSN`/`VITE_SENTRY_DSN` é **no-op** (nada inicializa).
- **API:** `@sentry/node` (v10, **baseado em OpenTelemetry** → auto-instrumenta
  Fastify/Prisma/HTTP = traces distribuídos). Init em `instrument.ts` (1º import
  + `node --import` em prod); captura via `setupFastifyErrorHandler`. `requestId`
  via `genReqId`/`x-request-id` (no log `reqId` e no header de resposta). Worker
  também instrumentado.
- **App:** `@sentry/react` (init opt-in + `browserTracingIntegration`) +
  `ObservabilityBoundary` (Sentry ErrorBoundary com fallback).
- **Próximos passos:** exportar OTel para um backend não-Sentry (OTLP) e
  Session Replay no front, se necessário.

### 10. API keys (acesso programático) 🟢 — ✅ FEITO

- **Status:** implementado. Ver `UPGRADES.md` → "API keys (acesso programático)".
- **Nota:** o plugin `apiKey` do Better Auth **não existe** na versão usada
  (1.6.x) nem na 1.7-beta — implementado como **módulo próprio**
  (`apps/api/src/modules/api-keys`), no padrão dos demais módulos.
- Model `ApiKeys`: token `bk_…` mostrado **uma vez**, só hash SHA-256 + prefixo
  guardados; escopo por **organização**, `scopes` (permissões), expiração,
  `lastUsedAt` e revogação. Migration `api_keys`.
- Gestão por sessão (`GET/POST/DELETE /api-keys`, restrito a owner/admin) +
  `requireApiKey(scope?)` para acesso programático (header `Authorization:
  Bearer bk_…` ou `x-api-key`) + endpoint de exemplo `GET /v1/ping`. Integra com
  audit (#8: `api_key.create`/`api_key.revoke`). Documentado no Scalar via
  `security: [{ Bearer: [] }]`.
- Front: página `/api-keys` (criar com token exibido 1x + copiar, listar,
  revogar). i18n pt-BR/en/es.
- **Próximos passos:** escopos finos por recurso e rate-limit por chave.

---

## 🥉 Tier 3 — polish / compliance / contexto Brasil

### 11. LGPD/GDPR — export + exclusão de conta 🟡 — ✅ FEITO

- **Status:** implementado. Ver `UPGRADES.md` → "LGPD/GDPR (export + exclusão)".
- **Export:** `GET /me/export` (`MeService.exportUserData`) compila os dados
  pessoais (perfil, contas/sessões **sanitizadas**, organizações, API keys sem
  hash, audit logs) em JSON para download. Página `/account` baixa o arquivo.
- **Exclusão:** `user.deleteUser` do Better Auth (reautenticação por senha);
  `afterDelete` limpa o que não cai por cascade (apaga API keys do usuário,
  anonimiza `actorId` dos audit logs). Member/sessions/accounts caem por FK.
- Página `/account` (exportar + danger zone com confirmação por senha).
- **Próximos passos:** export assíncrono via job (#5) gerando arquivo no S3
  (#14) + link por e-mail; fluxo de exclusão por e-mail para contas OAuth (sem
  senha).

### 12. 2FA / passkeys 🟢 🧩

- Plugin `twoFactor` (TOTP/OTP/backup codes) e/ou passkeys (WebAuthn).
  Skill: `two-factor-authentication-best-practices`.

### 13. Notificações in-app + preferências 🟡 — ✅ FEITO

- **Status:** implementado. Ver `UPGRADES.md` → "Notificações in-app + preferências".
- Models `Notifications` + `NotificationPreferences` (migration `notifications`).
- `NotificationService.notify(userId, …)` é o ponto de entrada: respeita as
  preferências por categoria (in-app cria o registro; e-mail enfileira via #5,
  template genérico `notification` no `@repo/emails`).
- Rotas (tag `Notifications`): listar + contagem de não lidas, marcar lida/
  todas, ler/salvar preferências e `POST /notifications/test` (demo).
- Front: **sino** no header (badge de não lidas) + página `/notifications`
  (lista com marcar lida + grade de preferências por categoria/canal).
- **Próximos passos:** disparar notificações em eventos reais (billing,
  convite, ban) e realtime (SSE/WebSocket) em vez de polling.

### 14. Upload de avatar/arquivos (S3) 🟢 — ✅ FEITO

- **Status:** implementado. Ver `UPGRADES.md` → "MinIO / S3 (uploads)".
- Módulo `storage`: `POST /uploads/avatar` gera um **POST pré-assinado**
  (`@aws-sdk/s3-presigned-post`); o arquivo vai **direto** do browser pro S3
  (não passa pela API). A policy força o tipo e limita o tamanho
  (`AVATAR_MAX_BYTES`, default 2 MB) — validação no storage, não só no client.
- **Opt-in:** sem `S3_BUCKET`+credenciais, a rota responde **503** (mesmo padrão
  do AbacatePay). Funciona com MinIO (`S3_ENDPOINT` → `forcePathStyle`) ou S3/R2.
- Front: `AvatarUpload` na página `/account` (preview + trocar foto → presign →
  upload → `authClient.updateUser({ image })`). i18n pt-BR/en/es.
- **Próximos passos:** uploads genéricos (anexos), remoção do objeto antigo ao
  trocar e antivírus/processamento (resize) via job (#5).

### 15. Product analytics + feature flags (PostHog) 🟢 — ✅ FEITO

- **Status:** implementado (frontend). Ver `UPGRADES.md` → "PostHog".
- **Opt-in:** sem `VITE_POSTHOG_KEY` é **no-op**. `posthog-js` inicializado em
  `apps/app/src/analytics.ts` (`initAnalytics`); pageviews capturados a cada
  navegação do router; `identifyUser`/`resetAnalytics` no login/logout.
- **Feature flags:** hook `useFeatureFlag(flag)` (degrada para `false` sem
  analytics) — demo no dashboard (badge "Beta" via flag `beta-banner`).
- **Session replay:** liga/desliga no painel do projeto PostHog.
- **Próximos passos:** flags no servidor (`posthog-node`) para gating de API e
  eventos de produto em ações-chave (signup, checkout).

### 16. Storybook no `packages/ui` 🟢

- Catálogo dos primitivos shadcn + tokens; ajuda a manter consistência visual.

### 17. Dockerfile + deploy 🟢

- `Dockerfile` para `apps/api` e `apps/app` (build multi-stage), `docker-compose`
  de produção e/ou config de deploy (o código já trata SSL no edge tipo Railway).

---

## Ordem sugerida

1. **#3 Testes + #4 CI** — blinda o que já existe antes de crescer.
2. **#2 E-mail** — destrava verificação/reset e e-mails de billing.
3. **#1 Organizations** — vira B2B, aproveitando o `ownerType` já modelado.
4. **#5 Jobs** — base pra webhooks robustos, LGPD, notificações.
5. Daí em diante, conforme a necessidade do produto (#6–#17).

> Este arquivo é um guia vivo — atualize status/prioridade conforme o produto evolui.
