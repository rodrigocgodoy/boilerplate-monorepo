# Deploy

Este documento **não escolhe** onde você vai hospedar. Infraestrutura é a camada
mais opinativa que existe e a decisão certa depende do seu time, orçamento e
tolerância a operação — coisas que um boilerplate não sabe. O que ele entrega é
o caminho pronto para qualquer destino: imagens que funcionam, uma stack que
sobe com um comando e a lista do que precisa existir em todo lugar.

## O que precisa existir em qualquer destino

Independente da plataforma, quatro coisas:

1. **Postgres** — o `DATABASE_URL` completo, com SSL onde o provedor exigir.
2. **Redis** *(opcional)* — sem `REDIS_URL` os jobs rodam inline, no processo da
   API. Funciona, mas sem retry, sem agendamento e sem worker separado.
3. **Variáveis de ambiente** — validadas no boot por `packages/env`. Faltou
   alguma, o processo não sobe e diz qual. `.env.example` lista todas com
   explicação. Os obrigatórios: `DATABASE_URL`, `COOKIE_SECRET`,
   `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL` — e `NODE_ENV=production`.
4. **Migrations aplicadas** antes de a aplicação servir tráfego.

> **`NODE_ENV=production` não é detalhe.** Bibliotecas de terceiros decidem o
> modo por ele, não pelo nosso `ENV`. Em especial, o rate limit do Better Auth
> (3 tentativas de login por 10s) **só liga** com `NODE_ENV=production`. O boot
> recusa subir se as duas discordarem, justamente para isso não passar batido.

### Migrations: onde rodar

`prisma migrate deploy` é idempotente e usa advisory lock, então concorrência
não corrompe estado. A questão é **quando**:

- **Preferível — antes do deploy** (fase de release da plataforma, serviço
  `migrate` do compose, ou init container). Se a migration falha, o deploy
  aborta. As imagens já suportam isso.
- **Alternativa — no start do container**: defina `RUN_MIGRATIONS_ON_START=true`.
  O entrypoint aplica antes de iniciar o processo. Use quando o destino não tem
  fase de release. Com várias réplicas, uma migration ruim vira crash loop em
  todas em vez de um deploy abortado — por isso não é o padrão.

### As variáveis `VITE_*` são assadas no build

O frontend é um bundle estático: `VITE_API_URL` e companhia entram no código em
**build time**. Não existe promover a mesma imagem de staging para produção e
trocar a URL da API — cada ambiente exige seu próprio build. É a causa nº 1 de
"o app em produção está chamando a API de staging".

### Observabilidade no deploy

Duas coisas que só fazem sentido no momento do deploy:

- **Release tracking** — injete o SHA do commit: `SENTRY_RELEASE=$(git rev-parse HEAD)`
  na API/worker e `VITE_SENTRY_RELEASE` no build do app (é build-arg, como todo
  `VITE_*`). Sem isso, todos os erros caem numa release só e some a informação
  de qual deploy quebrou.
- **Source maps** — gerados no build (`sourcemap: 'hidden'` no Vite,
  `sourceMap: true` no tsc). Faça o upload a partir do artefato de build, **antes**
  de construir a imagem, e não publique os `.map`:

  ```bash
  npx @sentry/cli sourcemaps inject --org SUA_ORG --project SEU_PROJ apps/app/dist
  npx @sentry/cli sourcemaps upload --org SUA_ORG --project SEU_PROJ \
    --release "$VITE_SENTRY_RELEASE" apps/app/dist
  ```

**Probes:** aponte liveness para `/health` e readiness para `/ready`. Trocá-las
faz uma queda de banco reiniciar a frota em vez de só tirá-la do balanceador.

## Imagens

```bash
# API
docker build -f apps/api/Dockerfile --target api -t boilerplate-api .

# Worker (mesmo build, outro CMD)
docker build -f apps/api/Dockerfile --target worker -t boilerplate-worker .

# App (VITE_* obrigatoriamente aqui)
docker build -f apps/app/Dockerfile -t boilerplate-app \
  --build-arg VITE_API_URL=https://api.seudominio.com .
```

Todas multi-stage, com estágios separados de dependências, build e runtime;
usuário não-root; `HEALTHCHECK` declarado; cache do store do pnpm via BuildKit.
O contexto de build é sempre a **raiz do monorepo**.

**API e worker compartilham a imagem** porque os handlers de job usam os serviços
da API. São dois alvos com `CMD` diferente, e escalam de forma independente do
mesmo jeito — o compose escala o worker com `--scale worker=3`.

**Sobre `.dockerignore`:** existe um só, na raiz, e é o que vale. O Docker lê o
`.dockerignore` do **contexto de build**, não do diretório do Dockerfile — como
o contexto é a raiz (necessário num monorepo, para o `turbo prune` enxergar os
workspaces), arquivos por app seriam ignorados em silêncio. Um arquivo que não
faz nada é pior que sua ausência.

**Sobre o tamanho da imagem da API (~680 MB):** o grosso é o CLI do Prisma, que
precisa estar ali para o `migrate deploy`. Tentei podar o que produção não
executa (studio, pglite, TypeScript) e não é possível: o CLI do Prisma 7 carrega
esses módulos no boot. Se o tamanho incomodar, tire as migrations da imagem —
um alvo separado só com o CLI, rodado na fase de release — e api/worker caem
para a faixa dos 350 MB. O app já é 52 MB (nginx servindo estático).

## Stack completa local ou em VPS

```bash
cp .env.example .env      # ajuste os segredos
docker compose -f docker-compose.prod.yml up --build -d
```

Sobe Postgres, Redis, migrations, API, worker e app. O banco não expõe porta
para fora da rede do compose.

## Opções de destino

### Railway — o caminho mais rápido

Postgres e Redis gerenciados em alguns cliques, deploy por Dockerfile ou
buildpack, variáveis pela UI.

- Crie **serviços separados** para api e worker apontando para o mesmo
  repositório, mudando só o Dockerfile target (`--target api` / `--target worker`).
  Um serviço só com os dois processos não escala de forma independente e derruba
  a API quando o worker reinicia.
- Use os bancos **gerenciados** (Postgres e Redis) em vez de subir containers:
  backup e upgrade deixam de ser problema seu.
- Migrations: `prisma migrate deploy` no *pre-deploy command*.
- O app é estático — sirva pela imagem nginx ou por um static host.

### Fly.io — deploy por Dockerfile, perto do usuário

- `fly launch` detecta o Dockerfile; aponte o target no `fly.toml`.
- **Regiões:** rode a aplicação perto do banco. Postgres numa região e app em
  outra transforma cada query em latência de rede.
- **Volumes:** o Fly Postgres não é gerenciado como o de um provedor de banco —
  é uma VM com volume, e backup/failover são responsabilidade sua. Para produção
  séria, considere um Postgres externo.
- Migrations: `release_command` no `fly.toml`.

### VPS com Docker Compose — o mais barato

`docker-compose.prod.yml` roda como está. O que ele **não** resolve:

- **Proxy reverso e TLS.** Coloque Caddy, Traefik ou nginx na frente para
  terminar HTTPS e rotear api/app. Caddy é o menor esforço (certificado
  automático).
- **Backup do Postgres.** O volume é seu problema: `pg_dump` agendado, para
  fora da máquina.
- **Deploy.** Sem pipeline, é `git pull && docker compose up --build -d`.

Barato e sob controle total, em troca de operação manual.

### AWS ECS / Cloud Run / Kubernetes — quando a escala pedir

As imagens funcionam sem alteração: são OCI padrão, com healthcheck e
shutdown gracioso (o worker termina o job em andamento antes de morrer — deixe
o `terminationGracePeriod` acima de `JOBS_SHUTDOWN_TIMEOUT_MS`, 30s por padrão).

O que muda não é a aplicação, é a infraestrutura ao redor: VPC, balanceador,
secrets manager, autoscaling. Isso vive como **infraestrutura como código, em
repositório separado** — ver a nota no fim.

## Comparativo

| Opção | Esforço | Custo aproximado | Faz sentido quando |
|---|---|---|---|
| **Railway** | Baixo — horas | ~US$ 20–50/mês | Você quer estar no ar hoje e prefere pagar para não operar banco |
| **Fly.io** | Médio — dia | ~US$ 10–40/mês | Latência global importa, ou você já usa Docker e quer controle sem gerenciar VM |
| **VPS + Compose** | Médio — dia, mais manutenção contínua | ~US$ 5–20/mês | Orçamento apertado, tráfego previsível, alguém disposto a cuidar de backup e TLS |
| **ECS / K8s** | Alto — semanas | US$ 100+/mês | Já existe time de plataforma, exigência de compliance, ou escala que justifique |

Custos são ordem de grandeza para uma aplicação pequena (API + worker + banco),
em 2026. Confirme no provedor.

Na dúvida: **Railway para validar o produto, VPS se o custo apertar, ECS/K8s só
quando houver quem opere.** Migrar depois é mais barato que operar Kubernetes
antes de ter usuários.

---

## Infraestrutura como código fica fora deste repositório

De propósito. Terraform, provisionamento de nuvem e definição de recursos
pertencem a um repositório próprio, por três razões:

1. **Portabilidade.** O boilerplate serve para qualquer destino; embutir
   Terraform da AWS escolheria por quem clona.
2. **Ciclo de vida diferente.** Infraestrutura muda por motivos e em ritmos que
   não são os da aplicação. Junto, a pasta mais volátil apodrece com o resto.
3. **Segurança.** State de Terraform carrega segredo em texto puro. Não é coisa
   para conviver com código de aplicação, ainda mais em repositório público.
