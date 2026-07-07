import { test, expect } from '@playwright/test'

const TRANSCRIPT = `Leandro: Bom dia, vamos iniciar a reunião de planejamento.
Ana: Temos três itens na pauta de hoje.
Leandro: Revisar o backlog e definir prioridades para a próxima sprint.
Ana: Concordo, vamos começar pelo backlog e definir as ações necessárias.`

async function importMeeting(page: any, title = `Reunião E2E ${Date.now()}`) {
  await page.goto('/meetings')
  await page.getByRole('button', { name: /importar transcrição/i }).first().click()
  await expect(page.getByText('Importar transcrição').last()).toBeVisible({ timeout: 5_000 })

  await page.getByPlaceholder('Cole aqui o texto da transcrição...').fill(TRANSCRIPT)
  await page.getByPlaceholder('Ex: Reunião de alinhamento').fill(title)

  // "Importar" exact — distinguishes from "↑ Importar transcrição" trigger button
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await page.waitForURL(/\/meetings\/\d+/, { timeout: 30_000 })
  return page.url()
}

test.describe('Reuniões — fluxos críticos', () => {

  test('importar transcrição cria uma reunião', async ({ page }) => {
    const url = await importMeeting(page)
    expect(url).toMatch(/\/meetings\/\d+/)
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('renomear reunião persiste o novo nome', async ({ page }) => {
    await importMeeting(page, 'Reunião Para Renomear')

    // MeetingTitleEditor: h1 is inside a <button title="Clique para renomear">
    await page.getByTitle('Clique para renomear').click()

    // After click, edit mode renders an <input> (not h1)
    const input = page.locator('input[class*="text-2xl"]')
    await expect(input).toBeVisible({ timeout: 3_000 })

    const newName = `Reunião Renomeada ${Date.now()}`
    await input.fill(newName)
    await input.press('Enter')

    // Wait for save API call to complete
    await page.waitForLoadState('networkidle')

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1').first()).toContainText(newName, { timeout: 5_000 })
  })

  test('excluir reunião move para lixeira e some da lista', async ({ page }) => {
    await importMeeting(page, 'Reunião Para Excluir')

    await page.goto('/meetings')
    await page.waitForLoadState('networkidle')

    const countBefore = await page.locator('a[href*="/meetings/"]').count()
    expect(countBefore).toBeGreaterThan(0)

    // Hover first meeting to reveal the ⋯ button
    await page.locator('a[href*="/meetings/"]').first().hover()

    // MeetingMenuButton is a ⋯ button — click it
    // The menu opens inline with buttons: "Abrir reunião", "Renomear", "Mover para lixeira"
    const menuTrigger = page.locator('button[class*="w-7 h-7"]').first()
    await menuTrigger.click()

    // Accept the native confirm() dialog that appears before deleting
    page.once('dialog', dialog => dialog.accept())

    await page.getByRole('button', { name: 'Mover para lixeira' }).click()

    await expect(page.locator('a[href*="/meetings/"]')).toHaveCount(
      Math.max(0, countBefore - 1),
      { timeout: 5_000 }
    )
  })

  test('busca filtra reuniões por título', async ({ page }) => {
    await page.goto('/meetings')
    await page.waitForLoadState('networkidle')

    await page.getByPlaceholder(/buscar|pesquisar|search/i).fill('xyzabc123inexistente')
    await page.keyboard.press('Enter')
    await page.waitForLoadState('networkidle')

    const count = await page.locator('a[href*="/meetings/"]').count()
    if (count > 0) {
      await expect(page.getByText(/nenhuma|sem resultado|não encontr/i)).toBeVisible({ timeout: 3_000 })
    }
  })
})
