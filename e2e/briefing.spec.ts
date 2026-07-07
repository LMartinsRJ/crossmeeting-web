import { test, expect } from '@playwright/test'

test.describe('Briefing — página inicial', () => {

  test('redireciona /dashboard para /briefing', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/briefing/)
  })

  test('carrega o briefing sem erros', async ({ page }) => {
    await page.goto('/briefing')
    await expect(page).not.toHaveURL(/\/login/)

    // Não deve ter mensagens de erro visíveis
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible()

    // Deve ter algum conteúdo carregado
    await expect(page.locator('main, [role="main"]').first()).toBeVisible()
  })

  test('link do sidebar navega para /meetings', async ({ page }) => {
    await page.goto('/briefing')

    await page.getByRole('link', { name: /reuniões|meetings/i }).first().click()
    await expect(page).toHaveURL(/\/meetings/)
  })

  test('link do sidebar navega para /spaces', async ({ page }) => {
    await page.goto('/briefing')

    await page.getByRole('link', { name: /spaces/i }).first().click()
    await expect(page).toHaveURL(/\/spaces/)
  })
})
