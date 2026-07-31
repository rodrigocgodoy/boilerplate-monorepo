---
description: Regenera o openapi.yaml e os hooks do Kubb após mudar rota/schema na API
allowed-tools: Bash(pnpm:*), Bash(git:*), Read
---

Regenere o contrato entre API e front.

1. `pnpm openapi` — sobe o Fastify em memória e escreve `apps/api/openapi.yaml`.
2. `pnpm api-client` — o Kubb lê o YAML e regenera `packages/api-client/gen`.
3. `pnpm build` — confirma que o app compila com o contrato novo.

Depois, **verifique o impacto**:

- Se algum `operationId` mudou, o nome do hook mudou junto. Rode
  `git diff --stat apps/api/openapi.yaml` e procure por imports quebrados no
  `apps/app` (o `tsc` do build acusa).
- Se alguma resposta mudou de forma, os testes que a asseguram precisam mudar
  também — não ajuste o teste para passar sem entender por que mudou.

Nunca edite `packages/api-client/gen/` à mão.
