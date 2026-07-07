import { test, expect } from '@playwright/test'

async function createSpace(page: any, name: string) {
  await page.goto('/spaces')
  await page.getByRole('button', { name: '+ Novo space' }).click()

  // Modal appears
  await expect(page.getByText('Novo space', { exact: true }).last()).toBeVisible({ timeout: 5_000 })

  await page.getByPlaceholder(/ex: cliente/i).fill(name)
  await page.getByRole('button', { name: 'Criar', exact: true }).click()

  // Modal closes (the <p>Novo space</p> inside the modal disappears)
  await page.waitForFunction(
    () => !document.querySelector('[class*="fixed inset-0"]'),
    { timeout: 5_000 }
  )
  await page.waitForLoadState('networkidle')
}

test.describe('Spaces — fluxos críticos', () => {

  test('criar novo space aparece na lista', async ({ page }) => {
    const spaceName = `Space E2E ${Date.now()}`
    await createSpace(page, spaceName)
    await expect(page.getByText(spaceName)).toBeVisible({ timeout: 5_000 })
  })

  test('space detalhe é acessível e mostra conteúdo', async ({ page }) => {
    const spaceName = `Space Detalhe ${Date.now()}`
    await createSpace(page, spaceName)

    await page.getByText(spaceName).first().click()
    await page.waitForURL(/\/spaces\/\d+/, { timeout: 5_000 })

    await expect(page.locator('h1').first()).toBeVisible()

    // New space has no meetings — should show empty state
    await expect(
      page.getByText('Nenhuma reunião neste space ainda.')
    ).toBeVisible({ timeout: 5_000 })
  })

  test('excluir space personalizado remove da lista', async ({ page }) => {
    const spaceName = `Space Para Excluir ${Date.now()}`
    await createSpace(page, spaceName)
    await expect(page.getByText(spaceName)).toBeVisible({ timeout: 5_000 })

    // Navigate into the space
    await page.getByText(spaceName).first().click()
    await page.waitForURL(/\/spaces\/\d+/, { timeout: 5_000 })

    // Click the 🗑️ Excluir button (DeleteSpaceButton trigger)
    await page.getByRole('button', { name: /excluir/i }).first().click()

    // Confirmation dialog appears inline — click the red "Excluir" confirm button
    await page.getByRole('button', { name: 'Excluir', exact: true }).last().click()

    // Should redirect back to /spaces
    await page.waitForURL(/\/spaces$/, { timeout: 5_000 })
    await expect(page.getByText(spaceName)).not.toBeVisible({ timeout: 3_000 })
  })
})
