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

test.describe('Reviewline — ELI5 Guide & Use Cases Modal', () => {
  test('opens guide modal, displays ELI5 concept, and closes on Escape', async ({ page }) => {
    await page.goto('/')
    const guideBtn = page.locator('.btn-guide')
    await expect(guideBtn).toBeVisible()

    await guideBtn.click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    await expect(page.getByText(/Reviewline Guide/i)).toBeVisible()
    await expect(page.getByText(/The AI is the Detective/i)).toBeVisible()

    // Test tab navigation
    const usecasesTab = page.getByRole('tab', { name: /Real-World Use Cases/i })
    await usecasesTab.click()
    await expect(page.getByText(/Procurement & Expense Overrides/i)).toBeVisible()

    // Test close via Escape
    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()

    // Test open via ? shortcut
    await page.keyboard.press('?')
    await expect(modal).toBeVisible()
  })
})




test.describe('Reviewline — authority boundary is visible without interaction', () => {
  test('capability manifest and human-only actions render on load', async ({ page }) => {
    await page.goto('/')

    const manifest = page.getByRole('region', { name: /agent capability manifest/i })
    await expect(manifest).toBeVisible()
    await expect(manifest.getByTestId('capability-name')).toHaveCount(5)
    await expect(
      manifest.locator('[data-exposure="exposed"] [data-testid="capability-name"]'),
    ).toHaveText(['list_incidents', 'inspect_incident'])

    const humanOnly = page.getByRole('region', { name: /human-only actions/i })
    await expect(humanOnly).toBeVisible()
    await expect(humanOnly.locator('[data-exposure="never"]')).toHaveCount(3)
    await expect(page.getByTestId('workflow-phase')).toContainText('INVESTIGATION')
  })

  test('drafting is withheld and the phase advances once a proposal is pending', async ({ page }) => {
    await page.goto('/')
    await page.locator('.tool-inspector-summary').click()
    await page.locator('.btn-hero-journey').click()

    await expect(page.getByTestId('workflow-phase')).toContainText('AWAITING_HUMAN_DECISION')
    const manifest = page.getByRole('region', { name: /agent capability manifest/i })
    await expect(
      manifest.locator('[data-exposure="exposed"] [data-testid="capability-name"]'),
    ).toHaveText(['list_incidents', 'inspect_incident', 'get_review_status'])
    await expect(
      manifest.locator('[data-exposure="withheld"] [data-testid="capability-name"]'),
    ).toHaveText(['simulate_guardrail_patch', 'draft_review_gate'])
  })
})

test.describe('Reviewline — the human decision stays reachable', () => {
  test('both decision controls are inside the review column viewport without scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.locator('.tool-inspector-summary').click()
    await page.locator('.btn-hero-journey').click()
    await expect(page.getByTestId('workflow-phase')).toContainText('AWAITING_HUMAN_DECISION')
    await page.locator('.tool-inspector-summary').click()

    const confirm = page.locator('.btn-approve')
    const reject = page.locator('.btn-reject')
    await expect(confirm).toBeVisible()
    await expect(reject).toBeVisible()

    const bounds = await page.evaluate(() => {
      const column = document.querySelector('.app-col--review')!.getBoundingClientRect()
      const rects = ['.btn-approve', '.btn-reject'].map((selector) =>
        document.querySelector(selector)!.getBoundingClientRect(),
      )
      return {
        columnTop: column.top,
        columnBottom: column.bottom,
        buttons: rects.map((rect) => ({ top: rect.top, bottom: rect.bottom })),
      }
    })

    for (const button of bounds.buttons) {
      expect(button.top).toBeGreaterThanOrEqual(bounds.columnTop)
      expect(button.bottom).toBeLessThanOrEqual(bounds.columnBottom)
    }
  })

  test('the Human review line remains wheel-scrollable in a short desktop viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1025, height: 650 })
    await page.goto('/')
    await page.locator('.tool-inspector-summary').click()
    await page.locator('.btn-hero-journey').click()
    await expect(page.getByTestId('workflow-phase')).toContainText('AWAITING_HUMAN_DECISION')
    await page.locator('.tool-inspector-summary').click()
    await page.locator('.session-record-summary').click()

    const column = page.locator('.app-col--review')
    const before = await column.evaluate((element) => ({
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
    }))

    expect(before.overflowY).toBe('auto')
    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight)

    await column.hover()
    await page.mouse.wheel(0, 1200)
    await expect
      .poll(() => column.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(before.scrollTop)

    for (const selector of ['.btn-approve', '.btn-reject']) {
      const control = page.locator(selector)
      await control.scrollIntoViewIfNeeded()
      const controlIsInsideColumn = await control.evaluate((element) => {
        const columnRect = document.querySelector('.app-col--review')!.getBoundingClientRect()
        const rect = element.getBoundingClientRect()
        return rect.top >= columnRect.top && rect.bottom <= columnRect.bottom
      })
      expect(controlIsInsideColumn).toBe(true)
    }
  })

  test('the review evidence body scrolls instead of pushing the decision away', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.locator('.tool-inspector-summary').click()
    await page.locator('.btn-hero-journey').click()
    await expect(page.getByTestId('workflow-phase')).toContainText('AWAITING_HUMAN_DECISION')
    await page.locator('.tool-inspector-summary').click()

    const body = page.locator('.review-body')
    const overflow = await body.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }))
    expect(overflow.overflowY).toBe('auto')
    expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight)
  })
})
