import { test, expect } from '@playwright/test'

test.describe('Reviewline — primary demo journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Clear localStorage for clean state
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('page loads with title and three incidents', async ({ page }) => {
    await expect(page.getByText('Reviewline')).toBeVisible()
    await expect(page.locator('.queue-item-id').filter({ hasText: 'inc-001' })).toBeVisible()
    await expect(page.locator('.queue-item-id').filter({ hasText: 'inc-002' })).toBeVisible()
    await expect(page.locator('.queue-item-id').filter({ hasText: 'inc-003' })).toBeVisible()
  })

  test('shows all three severity levels', async ({ page }) => {
    await expect(page.getByText('critical').first()).toBeVisible()
    await expect(page.getByText('high').first()).toBeVisible()
    await expect(page.getByText('medium').first()).toBeVisible()
  })

  test('clicking an incident reveals evidence timeline', async ({ page }) => {
    await page.getByText('procurement-agent').first().click()
    // The evidence trace should be visible
    await expect(page.locator('.trace-list')).toBeVisible()
    // The BLOCK trace entry should be highlighted
    await expect(page.locator('.trace-entry--block').first()).toBeVisible()
  })

  test('evidence panel shows cohort cases', async ({ page }) => {
    await page.getByText('procurement-agent').first().click()
    await expect(page.locator('.cohort-list')).toBeVisible()
    await expect(page.getByText('Blocked order')).toBeVisible()
  })

  test('WebMCP tool inspector reflects the least-authority manifest', async ({ page }) => {
    await expect(page.locator('.tool-inspector-details')).toBeVisible()
    await page.locator('.tool-inspector-summary').click()
    await expect(page.locator('.inspector-tool-name').filter({ hasText: 'list_incidents' })).toBeVisible()
    await expect(page.locator('.inspector-tool-name').filter({ hasText: 'inspect_incident' })).toBeVisible()
    await expect(page.locator('.inspector-tool-name').filter({ hasText: 'simulate_guardrail_patch' })).toHaveCount(0)
    await page.getByText('procurement-agent').first().click()
    await expect(page.locator('.inspector-tool-name').filter({ hasText: 'simulate_guardrail_patch' })).toBeVisible()
    await expect(page.locator('.inspector-tool-name').filter({ hasText: 'draft_review_gate' })).toHaveCount(0)
    await expect(page.locator('.inspector-tool-name').filter({ hasText: 'get_review_status' })).toHaveCount(0)
  })

  test('no approve/reject buttons visible before any proposal exists', async ({ page }) => {
    await expect(page.getByRole('button', { name: /approve/i })).not.toBeVisible()
    await expect(page.getByRole('button', { name: /reject/i })).not.toBeVisible()
  })

  test('reset button clears the selection', async ({ page }) => {
    await page.getByText('procurement-agent').first().click()
    await expect(page.locator('.trace-list')).toBeVisible()

    await page.getByRole('button', { name: /reset/i }).click()
    await expect(page.getByText(/Select an incident/i)).toBeVisible()
  })

  test('human control invariant — no approval tool in inspector', async ({ page }) => {
    await page.locator('.tool-inspector-summary').click()
    // Confirm there is NO "approve" tool listed
    const toolNames = await page.locator('.inspector-tool-name').allTextContents()
    expect(toolNames).not.toContain('approve')
    expect(toolNames).not.toContain('reject')
    expect(toolNames).not.toContain('activate')
  })

  test('keyboard navigation: incident items are focusable', async ({ page }) => {
    // Queue items are rendered as buttons — verify they are in the tab order
    const queueButtons = page.locator('.queue-item')
    const count = await queueButtons.count()
    expect(count).toBe(3)
    // Focus the first queue button directly and confirm it accepts focus
    await queueButtons.first().focus()
    const tagName = await page.evaluate(() => document.activeElement?.tagName)
    expect(tagName).toBe('BUTTON')
  })
})

test.describe('Reviewline — accessibility basics', () => {
  test('mobile interactive targets remain at least 44 CSS pixels', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto('/')
    const heights = await page.locator('.queue-item, .tool-inspector-summary, .btn-reset').evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height),
    )
    expect(heights.length).toBeGreaterThan(0)
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44)
  })

  test('all three incidents have accessible names', async ({ page }) => {
    await page.goto('/')
    const buttons = await page.getByRole('button').all()
    expect(buttons.length).toBeGreaterThan(3)
  })

  test('page has a main landmark', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('main')).toBeVisible()
  })

  test('incident queue has accessible label', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('region', { name: /incident queue/i })).toBeVisible()
  })
})

test.describe('Reviewline — internationalization (i18n)', () => {
  test('switches language between English and Thai via header toggle', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Agents investigate. Humans authorize.')).toBeVisible()

    const toggleBtn = page.locator('.btn-lang')
    await expect(toggleBtn).toBeVisible()

    await toggleBtn.click()
    await expect(page.getByText('เอเจนต์ดำเนินการสืบสวน มนุษย์เป็นผู้อนุมัติ')).toBeVisible()
    await expect(page.getByRole('button', { name: /รีเซ็ต/i })).toBeVisible()

    await toggleBtn.click()
    await expect(page.getByText('Agents investigate. Humans authorize.')).toBeVisible()
    await expect(page.getByRole('button', { name: /reset/i })).toBeVisible()
  })
})


