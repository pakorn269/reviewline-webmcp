import assert from 'node:assert/strict'
import process from 'node:process'
import { chromium } from 'playwright'
import { spawnPreview, createCleanup } from './preview-shutdown.mjs'

const chromeBin = process.env.CHROME_BIN ?? '/usr/local/bin/google-chrome'
const port = Number(process.env.REVIEWLINE_SMOKE_PORT ?? 4175)
const baseUrl = `http://127.0.0.1:${port}`
const forbiddenToolPattern = /(approve|reject|activate|deploy)/i

// Install cleanup synchronously as soon as the ChildProcess handle exists,
// before spawnPreview awaits its post-spawn handshake.
let preview
let previewLog = () => ''
let browser
let lifecycle
try {
  const spawned = await spawnPreview({
    port,
    onChild: (child) => {
      preview = child
      lifecycle = createCleanup(child, { getBrowser: () => browser })
      lifecycle.installSignals()
    },
  })
  preview = spawned.child
  previewLog = spawned.log
} catch (error) {
  lifecycle?.deregisterSignals()
  await lifecycle?.cleanup()
  throw error
}

async function waitForServer() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (preview.exitCode !== null || preview.signalCode !== null) throw new Error(`Preview exited early (code=${preview.exitCode}, signal=${preview.signalCode}).\n${previewLog()}`)
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(`Preview did not become ready.\n${previewLog()}`)
}

function sorted(names) {
  return [...names].sort()
}

async function manifest(page) {
  return page.evaluate(async () => {
    if (!document.modelContext?.getTools) return []
    return (await document.modelContext.getTools()).map((tool) => tool.name).sort()
  })
}

async function expectManifest(page, expected, phase) {
  const wanted = sorted(expected)
  const deadline = Date.now() + 10_000
  let actual = []
  while (Date.now() < deadline) {
    actual = await manifest(page)
    if (JSON.stringify(actual) === JSON.stringify(wanted)) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.deepEqual(actual, wanted, `${phase} manifest`)
  assert.equal(actual.some((name) => forbiddenToolPattern.test(name)), false, `${phase} exposed a forbidden authority tool`)
  return actual
}

async function execute(page, name, input) {
  const serialized = await page.evaluate(async ({ toolName, args }) => {
    const tools = await document.modelContext.getTools()
    const tool = tools.find((candidate) => candidate.name === toolName)
    if (!tool) throw new Error(`Tool is not available: ${toolName}`)
    return document.modelContext.executeTool(tool, JSON.stringify(args))
  }, { toolName: name, args: input })
  assert.equal(typeof serialized, 'string', `${name} must return Chrome 152 serialized JSON`)
  assert.ok(serialized.length < 1500, `${name} output exceeded 1,500 characters (${serialized.length})`)
  return JSON.parse(serialized)
}

try {
  await waitForServer()
  browser = await chromium.launch({
    executablePath: chromeBin,
    headless: true,
    args: ['--no-sandbox', '--enable-features=WebMCP,DevToolsWebMCPSupport'],
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const browserErrors = []
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()) })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => typeof document.modelContext?.getTools === 'function')

  const manifests = []
  manifests.push(await expectManifest(page, ['list_incidents', 'inspect_incident'], 'INVESTIGATION'))

  const listed = await execute(page, 'list_incidents', { severity: 'critical' })
  assert.equal(listed.total, 1)

  const inspected = await execute(page, 'inspect_incident', { incident_id: 'inc-001' })
  assert.equal(inspected.id, 'inc-001')
  assert.match(JSON.stringify(inspected), /UNTRUSTED-CONTENT/)
  manifests.push(await expectManifest(
    page,
    ['list_incidents', 'inspect_incident', 'simulate_guardrail_patch'],
    'INCIDENT_SELECTED',
  ))

  const simulation = await execute(page, 'simulate_guardrail_patch', {
    incident_id: 'inc-001',
    rule_kind: 'spending_cap',
    threshold: 50000,
    enforcement: 'block',
  })
  assert.equal(simulation.triggeringCaseId, 'c-001-a')
  assert.equal(simulation.benignControlCaseId, 'c-001-b')
  assert.deepEqual(simulation.regressions, [])
  manifests.push(await expectManifest(
    page,
    ['list_incidents', 'inspect_incident', 'simulate_guardrail_patch', 'draft_review_gate'],
    'REPLAY_READY',
  ))

  const proposal = await execute(page, 'draft_review_gate', {
    incident_id: 'inc-001',
    title: 'Retain bounded procurement authority',
    rationale: 'The trigger remains blocked while the named benign control remains allowed with no regression.',
    sim_id: simulation.simId,
  })
  assert.equal(proposal.status, 'pending')
  assert.match(proposal.message, /human review/i)
  manifests.push(await expectManifest(
    page,
    ['list_incidents', 'inspect_incident', 'get_review_status'],
    'AWAITING_HUMAN_DECISION',
  ))

  const pending = await execute(page, 'get_review_status', { proposal_id: proposal.proposalId })
  assert.equal(pending.status, 'pending')
  assert.match(pending.message, /No policy deployed/i)

  await page.getByLabel('Reviewer identity').fill('native-smoke-reviewer')
  await page.getByLabel('Review note').fill('Verified blocked trigger, allowed benign control, and no external deployment.')
  await page.getByLabel(/I reviewed the evidence/i).check()
  await page.getByRole('button', { name: /Confirm.*keep purchase blocked/i }).click()
  await page.waitForFunction(() => document.body.textContent?.includes('Human decision recorded'))
  manifests.push(await expectManifest(
    page,
    ['list_incidents', 'inspect_incident', 'get_review_status'],
    'DECIDED',
  ))

  const decided = await execute(page, 'get_review_status', { proposal_id: proposal.proposalId })
  assert.equal(decided.status, 'approved')
  assert.equal(decided.actor, 'human')
  assert.equal(decided.reviewerNote, 'Verified blocked trigger, allowed benign control, and no external deployment.')
  assert.match(decided.message, /No external policy was deployed/i)
  assert.equal(browserErrors.length, 0, `Browser errors: ${browserErrors.join(' | ')}`)

  const visibleTimeline = await page.locator('.timeline-event').count()
  assert.ok(visibleTimeline >= 10, `Expected a substantive visible timeline, found ${visibleTimeline} events`)

  console.log(JSON.stringify({
    ok: true,
    chrome: await browser.version(),
    manifests,
    simulation: {
      simId: simulation.simId,
      resultId: simulation.resultId,
      trigger: simulation.triggeringCaseId,
      benignControl: simulation.benignControlCaseId,
      regressions: simulation.regressions,
    },
    proposalId: proposal.proposalId,
    finalStatus: decided.status,
    reviewer: decided.actor,
    visibleTimelineEvents: visibleTimeline,
    browserErrors,
  }, null, 2))

  await context.close()
} finally {
  lifecycle.deregisterSignals()
  await lifecycle.cleanup()
}
