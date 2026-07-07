import { test as setup, expect } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'e2e@crossmeeting.test'
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'Crossmeeting@E2E2026!'

setup('autenticar usuário de teste', async ({ page, context }) => {
  // page.request has a SEPARATE cookie jar from the browser context.
  // We need to extract Set-Cookie headers and inject them into the browser context manually.
  const response = await page.request.post('http://localhost:3000/api/test/set-session', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })

  const body = await response.json().catch(() => ({}))
  expect(response.ok(), `Falha ao autenticar: ${JSON.stringify(body)}`).toBeTruthy()

  // Parse and inject each Set-Cookie header into the browser context
  const setCookieHeaders = response
    .headersArray()
    .filter(h => h.name.toLowerCase() === 'set-cookie')
    .map(h => h.value)

  for (const raw of setCookieHeaders) {
    const [nameValue, ...attrs] = raw.split(';').map(s => s.trim())
    const eqIdx = nameValue.indexOf('=')
    const name = nameValue.slice(0, eqIdx)
    const value = nameValue.slice(eqIdx + 1)
    const attrMap: Record<string, string> = {}
    for (const a of attrs) {
      const [k, v] = a.split('=')
      attrMap[k.trim().toLowerCase()] = (v ?? '').trim()
    }
    await context.addCookies([{
      name,
      value,
      domain: 'localhost',
      path: attrMap['path'] ?? '/',
      httpOnly: 'httponly' in attrMap,
      secure: 'secure' in attrMap,
      sameSite: (['Strict', 'Lax', 'None'].includes(attrMap['samesite'])
        ? attrMap['samesite'] : 'Lax') as 'Strict' | 'Lax' | 'None',
    }])
  }

  // Confirm the session is recognized by the middleware
  await page.goto('/briefing')
  await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

  await context.storageState({ path: 'e2e/.auth/user.json' })
})
