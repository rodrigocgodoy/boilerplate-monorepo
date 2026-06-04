import { expect, test } from '@playwright/test'

/**
 * Smoke E2E: a tela de login renderiza. O E2E não sobe a API, então
 * interceptamos a checagem de sessão (Better Auth `GET /auth/get-session`) e
 * devolvemos "sem sessão". Sem isso, o `getSession()` lança "Failed to fetch"
 * no `beforeLoad` e o router mostra o error boundary em vez do formulário.
 * Para fluxos autenticados de verdade, suba a stack completa (ver TESTING.md).
 * Seletores por id são estáveis entre idiomas.
 */
test('a tela de login renderiza os campos de e-mail e senha', async ({
  page,
}) => {
  await page.route('**/auth/get-session*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: 'null',
    }),
  )

  await page.goto('/login')
  await expect(page.locator('#signin-email')).toBeVisible()
  await expect(page.locator('#signin-password')).toBeVisible()
})

test('rota protegida sem sessão preserva o destino no ?redirect=', async ({
  page,
}) => {
  // Sem sessão: acessar um convite deve cair no login mantendo o destino.
  await page.route('**/auth/get-session*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: 'null',
    }),
  )
  await page.goto('/accept-invitation/test-invitation-id')
  await page.waitForURL(/\/login\?redirect=/)
  await expect(page).toHaveURL(
    /redirect=.*accept-invitation.*test-invitation-id/,
  )
  await expect(page.locator('#signin-email')).toBeVisible()
})

test('login leva ao fluxo de "esqueci a senha"', async ({ page }) => {
  await page.route('**/auth/get-session*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: 'null',
    }),
  )
  await page.goto('/login')
  await page.getByRole('link', { name: /esqueceu|forgot|olvidaste/i }).click()
  await page.waitForURL(/\/forgot-password/)
  await expect(page.locator('#forgot-email')).toBeVisible()
})

test('reset-password sem token mostra link inválido', async ({ page }) => {
  await page.route('**/auth/get-session*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: 'null',
    }),
  )
  // Sem ?token=, a página oferece pedir um novo link em vez do formulário.
  await page.goto('/reset-password')
  await expect(page.locator('#reset-password')).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: /novo link|new link|nuevo enlace/i }),
  ).toBeVisible()
})
