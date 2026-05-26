import { expect, test } from '@playwright/test'

/**
 * Smoke E2E: a tela de login renderiza mesmo sem a API (o guard cai em "sem
 * sessão" e mostra o formulário). Seletores por id são estáveis entre idiomas.
 */
test('a tela de login renderiza os campos de e-mail e senha', async ({
  page,
}) => {
  await page.goto('/login')
  await expect(page.locator('#signin-email')).toBeVisible()
  await expect(page.locator('#signin-password')).toBeVisible()
})
