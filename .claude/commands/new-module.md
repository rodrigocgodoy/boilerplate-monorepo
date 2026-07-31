---
description: Cria um módulo novo na API (route.ts + schemas.ts + service.ts) seguindo CONVENTIONS.md
argument-hint: "<nome-do-modulo> (kebab-case, ex: webhooks)"
allowed-tools: Bash(ls:*), Bash(pnpm:*), Read, Write, Edit, Glob, Grep
---

Crie um módulo novo na API seguindo **CONVENTIONS.md §2**. Leia essa seção se tiver dúvida.

Módulo: **$1** (kebab-case). Se vier vazio, pergunte o nome antes de criar qualquer coisa.

1. **Leia um módulo existente como referência** — `apps/api/src/modules/api-keys/` é
   o mais completo (guard, audit, erros). Copie o estilo exato: imports, sufixos de
   schema, uso de `getAuthSession`, `problem()` nos erros.
2. Crie `apps/api/src/modules/$1/` com os três arquivos:
   - **`schemas.ts`** — Zod de request/response, **tipados de verdade** (nada de
     `z.record` genérico). Nomes sufixados: `create<X>BodySchema`,
     `<x>ResponseSchema`. Para erros, reexporte o `problemSchema` de
     `@/utils/problem.js` (padrão dos outros módulos).
   - **`service.ts`** — regra de negócio + acesso a dados via `prisma`.
     **Sem Fastify aqui** (nada de `request`/`reply`) — é o que torna o teste
     unitário possível sem subir servidor.
   - **`route.ts`** — cada endpoint com `schema: { operationId, tags, summary,
     body/query/params, response }`. Handler fino: resolve sessão, chama o
     service, responde. Erros com `problem(request, status, detail)`.
3. **`operationId` é obrigatório e único** — é o nome do hook gerado. Descreva a
   **ação**, não o método: `listApiKeys`, `revokeApiKey`, `trackUsage`. Nunca
   `getApiKeys` derivado do path.
4. **Registre** o módulo em `apps/api/src/routes.ts`, seguindo o padrão dos existentes.
5. Se o módulo precisar de nova variável de ambiente, adicione em
   `packages/env/src/server.ts` **e** no `.env.example`, com comentário.
6. Rode `pnpm openapi && pnpm api-client` e confirme que o app compila (`pnpm build`).
7. **Escreva testes** — pelo menos os guards (401/403) via `app.inject`, no padrão
   de `apps/api/test/*.test.ts`. Se houver regra de negócio, teste o service isolado.
8. Ao final, mostre: endpoints criados, nomes dos hooks gerados, e o que ficou
   faltando (ex.: tela no front, teste de integração com banco).

Não edite `packages/api-client/gen/` à mão — é gerado.
