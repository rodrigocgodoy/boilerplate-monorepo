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
