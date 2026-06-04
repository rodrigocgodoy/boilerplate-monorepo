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

test('pedir o código avança para o passo do OTP + nova senha', async ({
  page,
}) => {
  await page.route('**/auth/get-session*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: 'null',
    }),
  )
  // Reset por OTP: pedir o código (request-password-reset) revela os campos de
  // código e nova senha, sem depender da API real.
  await page.route('**/auth/email-otp/request-password-reset*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    }),
  )
  await page.goto('/forgot-password')
  await page.locator('#forgot-email').fill('user@example.com')
  await page.getByRole('button').first().click()
  await expect(page.locator('#reset-otp')).toBeVisible()
  await expect(page.locator('#reset-password')).toBeVisible()
})
