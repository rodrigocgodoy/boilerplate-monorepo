# CONVENTIONS.md — como escrever código neste repositório

> **Leitura obrigatória antes de implementar qualquer feature.**
>
> O [`README.md`](./README.md) explica **o que** o boilerplate é e por que cada
> peça foi escolhida. O [`CLAUDE.md`](./CLAUDE.md) é o mapa rápido do repo. Este
> arquivo define **como** o código deve ser escrito — é o que impede um clone de
> virar outra coisa no terceiro mês.

---

## 0. Regras de ouro (inegociáveis)

1. **Contract-first.** O schema **Zod** no backend é a única fonte da verdade. O
   front **nunca** declara tipo de API na mão — sempre deriva do client gerado
   pelo Kubb.
2. **Zero `any` em contrato.** Se precisou de `as unknown as` para encaixar uma
   resposta, o schema está errado — conserte o schema, não a chamada.
3. **O front consome `@repo/api-client`.** Proibido `fetch`/`axios` manual para
   a API interna.
4. **UI base mora em `@repo/ui`.** Proibido recriar um primitivo dentro de um app.
5. **Backend é modular:** cada domínio = `route.ts` + `schemas.ts` + `service.ts`.
   `route.ts` não tem regra de negócio; `service.ts` não conhece Fastify.
6. **`operationId` obrigatório em toda rota** (§2). É ele que nomeia o hook.
7. **Configuração compartilhada vive em `packages/`**, não duplicada por app.
8. **Testar antes de dizer "pronto"** (§7). Build passar não basta.
9. **Segredo nunca entra em log, evento de erro ou bundle** (§8).

---

## 1. Nomes

### 1.1 Arquivos e pastas → `kebab-case`

```
components/auth/login-form.tsx        modules/api-keys/route.ts
components/modals/create-organization-modal.tsx
stores/modals/open-modals.ts          utils/rate-limit.ts
```

Um componente por arquivo, e o arquivo tem o nome do componente em kebab:
`LoginForm` → `login-form.tsx`. Casa com o shadcn/ui, que já é o padrão do
`@repo/ui`.

**Exceções (não renomeie):** gerados (`routeTree.gen.ts`, `packages/api-client/gen/**`)
e nomes que a ferramenta espera (`package.json`, `vite.config.ts`, `Dockerfile`).

### 1.2 Identificadores

| O que | Convenção | Exemplo |
|---|---|---|
| Componente / classe / `type` / `interface` | `PascalCase` | `LoginForm`, `EmailJob` |
| Função / variável / hook | `camelCase` | `getAuthSession`, `useGetCurrentUser` |
| Hook | `camelCase` com `use` | `useFeatureFlag` |
| Constante de módulo | `SCREAMING_SNAKE_CASE` | `REDACTED_PATHS`, `MODAL_ID` |
| Booleano | prefixo `is`/`has`/`can`/`should` | `isActive`, `hasSubscription` |

O arquivo é kebab, mas o **export continua PascalCase/camelCase**.

### 1.3 Idioma

- **Inglês** no código: arquivos, funções, variáveis, tipos, chaves internas.
- **Português** no que o usuário vê — mas via `@repo/i18n`, nunca string solta
  no componente. O boilerplate nasce com pt-BR, en e es.
- **Comentários em português** (é o idioma do time). Comentário explica **por
  quê**, não o quê: se o código precisa de comentário dizendo o que faz, o
  problema é o código.

### 1.4 Renomear com segurança

Sempre `git mv`. No macOS o filesystem é case-insensitive: um rename que muda só
a caixa (`LoginForm.tsx` → `login-form.tsx`) o git não rastreia e **quebra no CI
Linux**. Faça em dois passos, via nome temporário:

```bash
git mv LoginForm.tsx login-form.tmp.tsx
git mv login-form.tmp.tsx login-form.tsx
```

---

## 2. Backend — anatomia de um módulo

`apps/api/src/modules/<dominio>/`:

```
modules/api-keys/
├── route.ts      # rotas Fastify — só HTTP e validação, ZERO lógica
├── schemas.ts    # Zod de request/response — fonte da verdade do contrato
└── service.ts    # regra de negócio + dados. ZERO Fastify aqui.
```

### `schemas.ts` — o contrato

Um schema por body/query/params/response, com nome sufixado:
`createApiKeyBodySchema`, `apiKeyListResponseSchema`. Response tem que ser
**tipado de verdade** — nada de `z.record` genérico, porque é isso que vira o
tipo no front. Erros usam o `problemSchema` compartilhado (§5).

### `route.ts` — só HTTP

```ts
scope.get(
  '/api-keys',
  {
    schema: {
      operationId: 'listApiKeys',   // ← vira useListApiKeys no Kubb
      tags: ['ApiKeys'],            // ← agrupa os hooks
      summary: 'Lista as API keys da organização ativa',
      response: { 200: apiKeyListResponseSchema, 401: apiKeyErrorSchema },
    },
  },
  async (request, reply) => {
    const session = await getAuthSession(scope, request)
    if (!session) return reply.status(401).send(problem(request, 401, request.t('auth:unauthorized')))
    return reply.status(200).send(await scope.services.apiKeys.list(session))
  },
)
```

> **`operationId` é obrigatório e único.** Sem ele, o Kubb deriva o nome do hook
> de método + path: `usePostEntitlementsTrack`. Com ele: `useTrackUsage`. A
> diferença que importa não é estética — sem `operationId`, **mudar uma rota de
> lugar renomeia o hook e quebra todos os imports do front**. O nome deve
> descrever a ação, não o verbo HTTP.

Handler é fino: valida (o Zod já fez) → chama o service → responde.

### `service.ts` — lógica e dados

Não conhece `request`/`reply`. Recebe dados puros, devolve dados puros — é o que
torna o teste unitário possível sem subir Fastify.

---

## 3. Fluxo contract-first

```
schemas.ts (Zod) → route.ts → pnpm openapi → apps/api/openapi.yaml
                                                     │
                                          pnpm api-client (Kubb)
                                                     ▼
                          @repo/api-client (models + hooks TanStack Query)
                                                     ▼
                                      apps/app importa e usa o hook
```

**Depois de qualquer mudança de rota ou schema:**

```bash
pnpm openapi && pnpm api-client
```

Sem isso o front fica com contrato velho. **Nunca edite `packages/api-client/gen/`
à mão** — é gerado e não é versionado.

---

## 4. Frontend

- **Sempre os hooks gerados:** `import { useGetCurrentUser } from '@repo/api-client/hooks'`.
- Loading, erro e cache vêm do TanStack Query — não reinvente.
- Componente de **design system** (button, dialog, input) → `@repo/ui`.
  Componente de **feature** (`OrgSwitcher`, `NotificationBell`) → fica no app,
  composto de `@repo/ui`.
- Rota nova = arquivo em `apps/app/src/routes/`. `routeTree.gen.ts` é gerado.

### 4.1 Formulários — react-hook-form + Zod + `<Field/>` (obrigatório)

Nada de `useState` por campo com validação manual.

```tsx
<Controller
  control={form.control}
  name="email"
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="signin-email">{t('fields.email')}</FieldLabel>
      <Input {...field} id="signin-email" aria-invalid={fieldState.invalid} />
      <FieldError errors={[fieldState.error]} />
    </Field>
  )}
/>
```

- Schema Zod é a fonte da verdade da validação; `type FormValues = z.infer<typeof schema>`.
- `useForm({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues })`.
  Validar só no submit faz o usuário descobrir três erros de uma vez.
- `aria-invalid={fieldState.invalid}` no controle — os primitivos do `@repo/ui`
  já ficam com borda vermelha nesse estado. O `<FieldError/>` emite `role="alert"`,
  que é o que faz leitor de tela anunciar o problema.

**Referência canônica:** `apps/app/src/components/auth/login-form.tsx`.

### 4.2 Modais — `@ebay/nice-modal-react` (obrigatório)

Modal **não** é `useState(open)` no pai com `open`/`onOpenChange` descendo por
props. Isso força cada componente que abre um modal a hospedar o estado dele, e
o prop-drilling cresce com o app.

- **Componente:** `components/modals/<kebab>-modal.tsx`, com `NiceModal.create()`
  + `useModal(MODAL_ID)`. O modal é dono do próprio fluxo: valida, chama a API,
  trata erro e se fecha.
- **Registro:** `stores/modals/register-modals.ts`, importado uma vez no entrypoint.
- **Abertura:** só pelo wrapper tipado em `stores/modals/open-modals.ts`.
  **Nunca `NiceModal.show('id')` espalhado** — o id é string mágica: um typo
  falha em silêncio, e renomear vira caça ao texto.
- **Provider:** `<NiceModal.Provider>` dentro do `QueryClientProvider` (modal que
  faz mutation precisa do mesmo client).
- Formulário dentro do modal segue §4.1.

**Referência canônica:** `apps/app/src/components/modals/create-organization-modal.tsx`.

---

## 5. Erros da API — Problem Details (RFC 9457)

Todo erro sai como `application/problem+json` com `type`/`title`/`status`/`detail`,
mais `errors[]` na validação e o `requestId`. Erros **lançados** passam pelo
handler global; erros **retornados** pela rota usam o helper `problem(request, status, detail)`.

Nunca invente um formato novo de erro por módulo.

---

## 6. Jobs em background

Todo job declara um **schema Zod** em `apps/api/src/jobs/schemas.ts`, e o tipo do
handler é derivado dele. Esquecer o schema é erro de compilação. O payload é
validado no `enqueue` e de novo no worker — ele atravessa processo **e tempo**.

---

## 7. Testes

- **Vitest** — regra de negócio, componentes, contratos.
- **Playwright** — o caminho crítico, contra API e banco reais.
- Bug = teste que reproduz **vermelho** → fix → **verde**, os dois no mesmo commit.
- Teste não pode depender do ambiente: se ele passa com banco e falha sem, a
  asserção está errada, não o ambiente. Ver [`TESTING.md`](./TESTING.md).

---

## 8. Segurança

- Segredo **nunca** em log (`REDACTED_PATHS`), em evento do Sentry (`beforeSend`)
  ou no bundle (só `VITE_*` vai para o front — e nada sensível leva esse prefixo).
- Variável de ambiente entra em `packages/env` e é validada no boot.
- Rota nova que consome recurso caro merece perfil de rate limit próprio.

---

## 9. Git

- Trabalho em `feat/*` ou `fix/*`. Nunca commitar direto na branch de integração.
- `git fetch`/`merge` antes de push. Nunca `--force` em branch compartilhada.
- **Fluxo com `dev`** (opcional, ver [`docs/GIT-FLOW.md`](./docs/GIT-FLOW.md)):
  feature → `dev`, hotfix → `main`, e a Action `sync-main-to-dev` traz a `main`
  de volta automaticamente.

---

## 10. Anti-padrões

- ❌ Declarar tipo de API no front na mão, ou `as unknown as` para encaixar resposta.
- ❌ `fetch`/`axios` manual para a API interna (use o hook do Kubb).
- ❌ Rota sem `operationId` (o hook nasce com nome derivado do path).
- ❌ Lógica de negócio no `route.ts` (vai para o `service.ts`).
- ❌ Recriar primitivo do shadcn dentro de um app (vai para `@repo/ui`).
- ❌ Formulário com `useState` por campo (use RHF + Zod + `<Field/>` — §4.1).
- ❌ Modal com `useState(open)` e prop-drilling (use nice-modal — §4.2).
- ❌ `NiceModal.show('id')` fora de `open-modals.ts`.
- ❌ Editar `packages/api-client/gen/` ou `routeTree.gen.ts` (são gerados).
- ❌ Job sem schema Zod.
- ❌ Formato de erro próprio por módulo (use Problem Details — §5).
- ❌ String de UI hardcoded no componente (vai para `@repo/i18n`).
- ❌ Arquivo novo em `PascalCase`, ou rename só de caixa sem `git mv` de 2 passos.
- ❌ Teste cujo resultado muda conforme o ambiente.
