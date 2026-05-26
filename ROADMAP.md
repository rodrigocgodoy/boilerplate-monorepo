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
| 2 | E-mail transacional (Resend + React Email) | 1 | 🟡 M | — |
| 3 | Fundação de testes (Vitest + Playwright) | 1 | 🟡 M | — |
| 4 | CI/CD (GitHub Actions) | 1 | 🟢 P | #3 |
| 5 | Jobs em background (BullMQ + Redis) | 1 | 🟡 M | Redis |
| 6 | RBAC + painel admin | 2 | 🟡 M | #1 |
| 7 | Entitlements / limites por plano | 2 | 🟡 M | Assinaturas |
| 8 | Audit log | 2 | 🟢 P | — |
| 9 | Observabilidade (Sentry + OTel) | 2 | 🟡 M | — |
| 10 | API keys (acesso programático) | 2 | 🟢 P | #6 |
| 11 | LGPD/GDPR (export + exclusão de conta) | 3 | 🟡 M | #5 |
| 12 | 2FA / passkeys | 3 | 🟢 P | E-mail |
| 13 | Notificações in-app + preferências | 3 | 🟡 M | #5 |
| 14 | Upload de avatar/arquivos (S3) | 3 | 🟢 P | S3 |
| 15 | Product analytics + feature flags (PostHog) | 3 | 🟢 P | — |
| 16 | Storybook no `packages/ui` | 3 | 🟢 P | — |
| 17 | Dockerfile + deploy | 3 | 🟢 P | — |

**Top 3 pra dar o maior salto:** #1 Organizations, #2 E-mail, #3+#4 Testes+CI.

---

## 🥇 Tier 1 — fundação

### 1. Organizations / multi-tenancy 🔴 🧩

- **O quê:** workspaces/times com membros, convites, roles e troca de org ativa.
- **Por quê:** maior alavanca pra B2B; muda o "dono" dos recursos de usuário → org.
- **Como encaixa:** plugin `organization` do Better Auth (server + `auth-client`),
  depois `pnpm auth:generate` + `pnpm db:migrate`. **Conecta direto** com o
  `ownerType='ORGANIZATION'` já modelado em `Subscriptions` → assinatura por
  workspace. Skill: `.claude/skills/organization-best-practices`.
- **Atenção:** decidir escopo de billing (por usuário vs por org) e propagar o
  `organizationId` nas rotas/guards.

### 2. E-mail transacional (Resend + React Email) 🟡 🧩

- **O quê:** verificação de e-mail, reset de senha e e-mails de billing
  (cobrança paga, pagamento falhou, trial acabando, assinatura cancelada).
- **Por quê:** table-stakes; hoje só existe como guia em `UPGRADES.md`.
- **Como encaixa:** `resend` + hooks do Better Auth (`sendResetPassword`,
  `sendVerificationEmail`); templates com React Email num `packages/emails`.
  Disparar os e-mails de billing a partir do `SubscriptionService`/webhook.
  Skills: `email-and-password-best-practices`, `react-email`, `resend`.

### 3. Fundação de testes (Vitest + Playwright) 🟡 — ✅ FEITO

- **Status:** implementado. Ver [`TESTING.md`](./TESTING.md).
- Vitest por package (API com `app.inject`; `@repo/ui` com jsdom), task `test`
  no Turbo (`pnpm test`) e E2E com Playwright (`pnpm test:e2e`).
- Já cobre: guards das rotas de pagamento (503/400/401), HMAC do webhook,
  componente de UI e smoke E2E do login.
- **Próximos passos** (documentados no `TESTING.md`): integração com banco de
  teste e E2E autenticado (login → checkout).

### 4. CI/CD (GitHub Actions) 🟢

- **O quê:** pipeline `lint → typecheck → test → build` com cache do Turborepo,
  `--affected` para rodar só o que mudou, e checagem de migration (drift).
- **Por quê:** trava regressão por ~nada de custo.
- **Como encaixa:** `.github/workflows/ci.yml` + Postgres de serviço no runner;
  opcional remote cache do Turborepo.

### 5. Jobs em background (BullMQ + Redis) 🟡

- **O quê:** fila para trabalho assíncrono e agendado.
- **Por quê:** webhooks devem ser processados async/idempotente; e-mails, varrer
  trials/renovações vencidas, retries com backoff.
- **Como encaixa:** `bullmq` + Redis (já no `UPGRADES.md`); um `packages/jobs`
  com workers e um agendador (repeatable jobs) para tarefas periódicas.

---

## 🥈 Tier 2 — diferenciais de SaaS

### 6. RBAC + painel admin 🟡 🧩

- **O quê:** papéis/permissões e um painel pra gestão de usuários, impersonation
  e ban.
- **Como encaixa:** plugin `admin` do Better Auth + uma área `_app/_admin`
  guardada por role. Combina com #1 (roles por org).

### 7. Entitlements / limites por plano 🟡

- **O quê:** transformar `plan.features` (ex.: `{ seats, projects, apiCalls }`)
  em regras de uso: `canUseFeature(feature)` e `checkQuota(metric)` + contadores.
- **Por quê:** é o que dá sentido prático aos planos além do gate "tem plano?".
- **Como encaixa:** extensão do `requireActivePlan` + uma tabela de uso/medições;
  pode alimentar pricing usage-based no futuro.

### 8. Audit log 🟢

- **O quê:** trilha de ações sensíveis (cancelou assinatura, mudou role, removeu
  membro, gerou API key…).
- **Como encaixa:** model `AuditLogs` + um helper/hook no Fastify que registra
  `{ actorId, action, target, metadata }`. Importante pra B2B/compliance.

### 9. Observabilidade (Sentry + OpenTelemetry) 🟡

- **O quê:** captura de erros, traces distribuídos e logs estruturados.
- **Como encaixa:** `@sentry/node` na API e `@sentry/react` no app; OTel
  instrumentando Fastify/Prisma; pino (já presente) com `requestId`.

### 10. API keys (acesso programático) 🟢 🧩

- **O quê:** chaves de API para clientes/integrações chamarem a API.
- **Como encaixa:** plugin `apiKey` do Better Auth + scoping por org/permissão
  (#6). Documentar no Scalar (`/reference`).

---

## 🥉 Tier 3 — polish / compliance / contexto Brasil

### 11. LGPD/GDPR — export + exclusão de conta 🟡

- Export dos dados do usuário (job async, #5) e exclusão/anonimização de conta.
  Relevante no Brasil — e o produto já lida com PIX/pagamentos.

### 12. 2FA / passkeys 🟢 🧩

- Plugin `twoFactor` (TOTP/OTP/backup codes) e/ou passkeys (WebAuthn).
  Skill: `two-factor-authentication-best-practices`.

### 13. Notificações in-app + preferências 🟡

- Centro de notificações (model + rota + sino no header) e preferências de
  e-mail por categoria. Dispara via #5.

### 14. Upload de avatar/arquivos (S3) 🟢

- Fiar o S3/MinIO do `UPGRADES.md`: upload com URL pré-assinada, avatar no
  perfil, validação de tipo/tamanho.

### 15. Product analytics + feature flags (PostHog) 🟢

- PostHog cobre analytics de produto, **feature flags** genéricas (independente
  de plano) e session replay com um pacote só.

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
