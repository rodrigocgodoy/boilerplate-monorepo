#!/bin/sh
set -e

# Entrypoint da API e do worker.
#
# Aplica as migrations antes de iniciar, quando `RUN_MIGRATIONS_ON_START=true`.
# `prisma migrate deploy` é idempotente e usa advisory lock no Postgres, então
# várias réplicas subindo juntas não corrompem o estado — a segunda espera e
# encontra tudo aplicado.
#
# Fica **desligado por padrão** de propósito. Em plataformas com fase de release
# (Railway, Fly) ou com o serviço `migrate` do compose, a migration roda uma vez,
# antes do deploy — que é o lugar certo: uma migration que falha deve abortar o
# deploy, não deixar N réplicas em crash loop. Ligue quando o destino não tiver
# esse recurso (VPS simples, por exemplo). Ver DEPLOYING.md.

if [ "${RUN_MIGRATIONS_ON_START}" = "true" ]; then
  echo "[entrypoint] aplicando migrations (prisma migrate deploy)…"
  # Roda de dentro do pacote do banco: a imagem é o resultado de um
  # `pnpm deploy`, que achata o workspace — não existe mais monorepo aqui, e um
  # `pnpm --filter @repo/database` não casaria com nada **e sairia com código
  # 0**, dando um "migrations aplicadas" que não aplicou nada.
  # Chama o binário direto, sem `pnpm exec`: a imagem é o resultado de um
  # `pnpm deploy`, que achata o workspace. Ali um `pnpm --filter @repo/database`
  # não casa com nada **e sai com código 0** (um "aplicadas" que não aplicou), e
  # um `pnpm exec` faz o corepack baixar o pnpm e tentar instalar em runtime.
  cd /app/node_modules/@repo/database
  ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
  cd /app
  echo "[entrypoint] migrations aplicadas"
fi

exec "$@"
