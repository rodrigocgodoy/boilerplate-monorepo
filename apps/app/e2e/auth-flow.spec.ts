import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

/**
 * **O** teste E2E do boilerplate: o caminho crítico ponta a ponta, sem um único
 * mock — browser real, API real, Postgres real.
 *
 * Cria conta → sessão → dashboard → `GET /me` pelo hook gerado pelo Kubb →
 * logout. Se este teste passa, o fluxo Zod → OpenAPI → Kubb → React está
 * inteiro; é o único teste da suíte capaz de afirmar isso.
 *
 * Roda com `pnpm test:e2e` na raiz (sobe e derruba o banco sozinho). Sem
 * `TEST_DATABASE_URL` não há API para conversar, e o teste se pula em vez de
 * falhar por falta de infra.
 */
test.skip(
  !process.env.TEST_DATABASE_URL,
  'precisa da stack completa — use `pnpm test:e2e` na raiz',
)

test('criar conta leva ao dashboard com os dados do GET /me', async ({
  page,
}) => {
  // E-mail único por execução: o banco é efêmero, mas retries dentro da mesma
  // execução reusariam o e-mail e esbarrariam no cadastro duplicado.
  const email = `e2e-${randomUUID()}@test.dev`
  const password = 'senha-super-secreta'
  const name = 'Ana E2E'

  await page.goto('/login')

  await page
    .getByRole('tab', { name: /criar conta|sign up|crear cuenta/i })
    .click()

  await page.locator('#signup-name').fill(name)
  await page.locator('#signup-email').fill(email)
  await page.locator('#signup-password').fill(password)
  await page
    .locator('form')
    .filter({ has: page.locator('#signup-email') })
    .getByRole('button')
    .click()

  // O redirect pós-cadastro é o dashboard.
  await page.waitForURL(/\/dashboard/)

  // Escopado no `<dl>` que o dashboard preenche com a resposta do `GET /me`.
  // Sem esse escopo, o nome também casaria com o seletor de organização (o
  // signup cria uma org pessoal homônima) — e o teste passaria sem provar que
  // a requisição aconteceu.
  const meFields = page.locator('dl')
  await expect(meFields.getByText(email)).toBeVisible()
  await expect(meFields.getByText(name)).toBeVisible()

  // Logout devolve ao login e a rota protegida deixa de abrir.
  await page.getByRole('button', { name: /sair|sign out|salir/i }).click()
  await page.waitForURL(/\/login/)

  await page.goto('/dashboard')
  await page.waitForURL(/\/login/)
})
