import { prisma } from '../src/client.js'

/**
 * Seed dos planos. Idempotente (upsert por `slug`).
 *
 * `externalProductId` fica nulo aqui — preencha com o id do produto criado na
 * loja do AbacatePay (`prod_...`, com o `cycle` correspondente) para habilitar
 * a recorrência nativa v2. Sem ele, a rota de assinatura responde erro claro.
 */
const plans = [
  {
    slug: 'starter',
    name: 'Starter',
    description: 'Plano gratuito para começar.',
    priceCents: 0,
    interval: 'MONTHLY',
    trialDays: 0,
    externalProductId: null,
    features: { seats: 1, projects: 1, apiCalls: 1_000 },
    sortOrder: 0,
  },
  {
    slug: 'pro-monthly',
    name: 'Pro (mensal)',
    description: 'Recursos completos, cobrança mensal.',
    priceCents: 4990,
    interval: 'MONTHLY',
    trialDays: 7,
    externalProductId: null,
    features: { seats: 5, projects: 20, apiCalls: 100_000 },
    sortOrder: 1,
  },
  {
    slug: 'pro-annual',
    name: 'Pro (anual)',
    description: 'Recursos completos, cobrança anual (2 meses grátis).',
    priceCents: 49900,
    interval: 'ANNUALLY',
    trialDays: 7,
    externalProductId: null,
    features: { seats: 5, projects: 20, apiCalls: 100_000 },
    sortOrder: 2,
  },
]

async function main() {
  for (const plan of plans) {
    await prisma.plans.upsert({
      where: { slug: plan.slug },
      create: plan,
      update: {
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        interval: plan.interval,
        trialDays: plan.trialDays,
        features: plan.features,
        sortOrder: plan.sortOrder,
      },
    })
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${plans.length} plans`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async error => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
