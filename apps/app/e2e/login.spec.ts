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
