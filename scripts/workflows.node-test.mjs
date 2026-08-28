/**
 * Structural YAML workflow validation — exact enforcement.
 *
 * Validates the COMPLETE structure of ci.yml and pages.yml: exact files, exact
 * top-level keys, exact jobs, exact job keys, exact step arrays (order, keys,
 * values), exact triggers, exact permissions, exact concurrency. No extra/missing
 * steps, no suffix injection, no substring matching. Comments are ignored by the
 * YAML parser. Actionlint is independent grammar gate.
 */
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { describe, it } from 'node:test'
import YAML from 'yaml'

const workflowDir = resolve('.github/workflows')
const ALLOWED_FILES = ['ci.yml', 'pages.yml']
const DEPLOYMENT_EXPR = '${{ steps.deployment.outputs.page_url }}'

/* ===== Canonical step definitions ===== */

const CI_STEPS = [
  { uses: 'actions/checkout@v7' },
  { uses: 'actions/setup-node@v7', with: { 'node-version': '24', cache: 'npm' } },
  { name: 'Install dependencies', run: 'npm ci' },
  { name: 'Unit & component tests', run: 'npm test' },
  { name: 'Type check', run: 'npm run typecheck' },
  { name: 'Lint (zero warnings)', run: 'npm run lint' },
  { name: 'Production build', run: 'npm run build' },
  { name: 'Dedicated script tests', run: 'node --test scripts/*.node-test.mjs' },
  { name: 'Security audit', run: 'npm run audit:security' },
  { name: 'Install Playwright browsers', run: 'npx playwright install --with-deps chromium' },
  { name: 'E2E tests', run: 'npm run e2e' },
]

const PAGES_BUILD_STEPS = [
  { uses: 'actions/checkout@v7' },
  { uses: 'actions/setup-node@v7', with: { 'node-version': '24', cache: 'npm' } },
  { run: 'npm ci' },
  { run: 'node --test scripts/verify-portable-build.node-test.mjs' },
  { name: 'Build for project Pages', run: 'npm run build -- --base /reviewline-webmcp/' },
  { run: 'node scripts/verify-portable-build.mjs /reviewline-webmcp/' },
  { uses: 'actions/configure-pages@v6' },
  { uses: 'actions/upload-pages-artifact@v5', with: { path: 'dist' } },
]

const PAGES_DEPLOY_STEPS = [
  { name: 'Deploy', id: 'deployment', uses: 'actions/deploy-pages@v5' },
]

/* ===== Helpers ===== */

function parseStrict(content, name) {
  const doc = YAML.parseDocument(content, { strict: true })
  if (doc.errors.length) throw new Error(`${name}: parse errors: ${doc.errors.map(e => e.message).join('; ')}`)
  if (doc.warnings.length) throw new Error(`${name}: warnings: ${doc.warnings.map(w => w.message).join('; ')}`)
  return doc.toJSON()
}

/** Deep equality check returning descriptive error or null. */
function deepMatch(actual, expected, path) {
  if (actual === expected) return null
  if (typeof expected !== typeof actual) return `${path}: type mismatch (${typeof actual} vs ${typeof expected})`
  if (expected === null || actual === null) return `${path}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return `${path}: expected array, got ${typeof actual}`
    if (actual.length !== expected.length) return `${path}: length ${actual.length} !== ${expected.length}`
    for (let i = 0; i < expected.length; i++) {
      const err = deepMatch(actual[i], expected[i], `${path}[${i}]`)
      if (err) return err
    }
    return null
  }
  if (typeof expected === 'object') {
    const ek = Object.keys(expected).sort()
    const ak = Object.keys(actual).sort()
    if (JSON.stringify(ak) !== JSON.stringify(ek)) return `${path}: keys ${JSON.stringify(ak)} !== ${JSON.stringify(ek)}`
    for (const k of ek) {
      const err = deepMatch(actual[k], expected[k], `${path}.${k}`)
      if (err) return err
    }
    return null
  }
  return `${path}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`
}

/** Recursively find all ${{...}} expressions in parsed values with paths. */
function findExpressions(obj, path = '') {
  const results = []
  if (obj == null) return results
  if (typeof obj === 'string') {
    for (const m of obj.matchAll(/\$\{\{[^}]*\}\}/g)) results.push({ expr: m[0].trim(), path })
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => results.push(...findExpressions(v, `${path}[${i}]`)))
  } else if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) results.push(...findExpressions(v, path ? `${path}.${k}` : k))
  }
  return results
}

/* ===== Exported validators ===== */

export function validateCiWorkflow(parsed) {
  const errors = []
  if (parsed.name !== 'CI') errors.push(`CI name: ${JSON.stringify(parsed.name)} !== "CI"`)
  // Top-level keys
  const topKeys = Object.keys(parsed).sort()
  const expectedTop = ['jobs', 'name', 'on'].sort()
  if (JSON.stringify(topKeys) !== JSON.stringify(expectedTop)) errors.push(`CI top keys: ${JSON.stringify(topKeys)} !== ${JSON.stringify(expectedTop)}`)
  // Triggers
  const expectedOn = { push: { branches: ['main'] }, pull_request: { branches: ['main'] } }
  const onErr = deepMatch(parsed.on, expectedOn, 'on')
  if (onErr) errors.push(onErr)
  // Jobs
  const jobs = Object.keys(parsed.jobs ?? {})
  if (jobs.length !== 1 || jobs[0] !== 'quality') errors.push(`CI jobs: expected ['quality'], got ${JSON.stringify(jobs)}`)
  const job = parsed.jobs?.quality
  if (!job) { errors.push('Missing quality job'); return errors }
  // Job keys
  const expectedJobKeys = ['name', 'permissions', 'runs-on', 'steps'].sort()
  const actualJobKeys = Object.keys(job).sort()
  if (JSON.stringify(actualJobKeys) !== JSON.stringify(expectedJobKeys)) errors.push(`CI job keys: ${JSON.stringify(actualJobKeys)} !== ${JSON.stringify(expectedJobKeys)}`)
  // Permissions and fixed runner/job identity
  if (job.name !== 'Test, Typecheck, Lint, Build, Audit') errors.push(`CI job name: ${JSON.stringify(job.name)}`)
  if (job['runs-on'] !== 'ubuntu-latest') errors.push(`CI runs-on: ${JSON.stringify(job['runs-on'])}`)
  const permErr = deepMatch(job.permissions, { contents: 'read' }, 'permissions')
  if (permErr) errors.push(permErr)
  // Steps (exact array)
  const stepsErr = deepMatch(job.steps, CI_STEPS, 'steps')
  if (stepsErr) errors.push(stepsErr)
  // No expressions anywhere
  const exprs = findExpressions(parsed)
  if (exprs.length) errors.push(`CI has expressions: ${JSON.stringify(exprs)}`)
  return errors
}

export function validatePagesWorkflow(parsed) {
  const errors = []
  if (parsed.name !== 'Deploy GitHub Pages') errors.push(`Pages name: ${JSON.stringify(parsed.name)}`)
  // Top-level keys
  const topKeys = Object.keys(parsed).sort()
  const expectedTop = ['concurrency', 'jobs', 'name', 'on'].sort()
  if (JSON.stringify(topKeys) !== JSON.stringify(expectedTop)) errors.push(`Pages top keys: ${JSON.stringify(topKeys)} !== ${JSON.stringify(expectedTop)}`)
  // Triggers
  const expectedOn = { push: { branches: ['main'] }, workflow_dispatch: null }
  const onErr = deepMatch(parsed.on, expectedOn, 'on')
  if (onErr) errors.push(onErr)
  // Concurrency
  const expectedConc = { group: 'pages', 'cancel-in-progress': true }
  const concErr = deepMatch(parsed.concurrency, expectedConc, 'concurrency')
  if (concErr) errors.push(concErr)
  // Jobs
  const jobs = Object.keys(parsed.jobs ?? {}).sort()
  if (JSON.stringify(jobs) !== JSON.stringify(['build', 'deploy'])) errors.push(`Pages jobs: ${JSON.stringify(jobs)}`)
  // Build job
  const build = parsed.jobs?.build
  if (build) {
    const bKeys = Object.keys(build).sort()
    const expectedBKeys = ['permissions', 'runs-on', 'steps'].sort()
    if (JSON.stringify(bKeys) !== JSON.stringify(expectedBKeys)) errors.push(`Build job keys: ${JSON.stringify(bKeys)} !== ${JSON.stringify(expectedBKeys)}`)
    if (build['runs-on'] !== 'ubuntu-latest') errors.push(`Build runs-on: ${JSON.stringify(build['runs-on'])}`)
    const bpErr = deepMatch(build.permissions, { contents: 'read', pages: 'read' }, 'build.permissions')
    if (bpErr) errors.push(bpErr)
    const bsErr = deepMatch(build.steps, PAGES_BUILD_STEPS, 'build.steps')
    if (bsErr) errors.push(bsErr)
  }
  // Deploy job
  const deploy = parsed.jobs?.deploy
  if (deploy) {
    const dKeys = Object.keys(deploy).sort()
    const expectedDKeys = ['environment', 'needs', 'permissions', 'runs-on', 'steps'].sort()
    if (JSON.stringify(dKeys) !== JSON.stringify(expectedDKeys)) errors.push(`Deploy job keys: ${JSON.stringify(dKeys)} !== ${JSON.stringify(expectedDKeys)}`)
    if (deploy['runs-on'] !== 'ubuntu-latest') errors.push(`Deploy runs-on: ${JSON.stringify(deploy['runs-on'])}`)
    if (deploy.needs !== 'build') errors.push(`deploy.needs: ${deploy.needs}`)
    const dpErr = deepMatch(deploy.permissions, { pages: 'write', 'id-token': 'write' }, 'deploy.permissions')
    if (dpErr) errors.push(dpErr)
    const envErr = deepMatch(deploy.environment, { name: 'github-pages', url: DEPLOYMENT_EXPR }, 'deploy.environment')
    if (envErr) errors.push(envErr)
    const dsErr = deepMatch(deploy.steps, PAGES_DEPLOY_STEPS, 'deploy.steps')
    if (dsErr) errors.push(dsErr)
  }
  // Expression must be ONLY at deploy.environment.url
  const allExprs = findExpressions(parsed)
  if (allExprs.length !== 1 || allExprs[0].path !== 'jobs.deploy.environment.url' || allExprs[0].expr !== DEPLOYMENT_EXPR) {
    errors.push(`Expressions: expected exactly [${DEPLOYMENT_EXPR}] at jobs.deploy.environment.url; got ${JSON.stringify(allExprs)}`)
  }
  return errors
}

/* ===== Tests ===== */

describe('workflow-validation', () => {
  // Synthetic RED fixtures — all call the same exported validators

  it('rejects extra run step in CI', () => {
    const steps = [...CI_STEPS, { run: 'echo evil' }]
    const parsed = { name: 'CI', on: { push: { branches: ['main'] }, pull_request: { branches: ['main'] } }, jobs: { quality: { name: 'Test, Typecheck, Lint, Build, Audit', 'runs-on': 'ubuntu-latest', permissions: { contents: 'read' }, steps } } }
    assert.ok(validateCiWorkflow(parsed).length > 0)
  })

  it('rejects command suffix injection in CI', () => {
    const steps = CI_STEPS.map(s => s.run === 'npm test' ? { ...s, run: 'npm test && echo pwned' } : s)
    const parsed = { name: 'CI', on: { push: { branches: ['main'] }, pull_request: { branches: ['main'] } }, jobs: { quality: { name: 'Test, Typecheck, Lint, Build, Audit', 'runs-on': 'ubuntu-latest', permissions: { contents: 'read' }, steps } } }
    assert.ok(validateCiWorkflow(parsed).length > 0)
  })

  it('rejects reversed command order in CI', () => {
    const steps = [...CI_STEPS.slice(0, 2), CI_STEPS[4], CI_STEPS[3], CI_STEPS[2], ...CI_STEPS.slice(5)]
    const parsed = { name: 'CI', on: { push: { branches: ['main'] }, pull_request: { branches: ['main'] } }, jobs: { quality: { name: 'Test, Typecheck, Lint, Build, Audit', 'runs-on': 'ubuntu-latest', permissions: { contents: 'read' }, steps } } }
    assert.ok(validateCiWorkflow(parsed).length > 0)
  })

  it('rejects write-all permissions in CI', () => {
    const parsed = { name: 'CI', on: { push: { branches: ['main'] }, pull_request: { branches: ['main'] } }, jobs: { quality: { name: 'Test, Typecheck, Lint, Build, Audit', 'runs-on': 'ubuntu-latest', permissions: 'write-all', steps: CI_STEPS } } }
    assert.ok(validateCiWorkflow(parsed).length > 0)
  })

  it('rejects unsafe checkout input in CI', () => {
    const steps = CI_STEPS.map(s => s.uses === 'actions/checkout@v7' ? { uses: 'actions/checkout@v7', with: { 'persist-credentials': true } } : s)
    const parsed = { name: 'CI', on: { push: { branches: ['main'] }, pull_request: { branches: ['main'] } }, jobs: { quality: { name: 'Test, Typecheck, Lint, Build, Audit', 'runs-on': 'ubuntu-latest', permissions: { contents: 'read' }, steps } } }
    assert.ok(validateCiWorkflow(parsed).length > 0)
  })

  it('rejects extra action in CI', () => {
    const steps = [...CI_STEPS.slice(0, 2), { uses: 'actions/evil@v99' }, ...CI_STEPS.slice(2)]
    const parsed = { name: 'CI', on: { push: { branches: ['main'] }, pull_request: { branches: ['main'] } }, jobs: { quality: { name: 'Test, Typecheck, Lint, Build, Audit', 'runs-on': 'ubuntu-latest', permissions: { contents: 'read' }, steps } } }
    assert.ok(validateCiWorkflow(parsed).length > 0)
  })

  it('rejects extra run step in Pages build', () => {
    const steps = [...PAGES_BUILD_STEPS, { run: 'echo evil' }]
    const parsed = { name: 'Deploy GitHub Pages', on: { push: { branches: ['main'] }, workflow_dispatch: null }, concurrency: { group: 'pages', 'cancel-in-progress': true }, jobs: { build: { 'runs-on': 'ubuntu-latest', permissions: { contents: 'read', pages: 'read' }, steps }, deploy: { environment: { name: 'github-pages', url: DEPLOYMENT_EXPR }, 'runs-on': 'ubuntu-latest', needs: 'build', permissions: { pages: 'write', 'id-token': 'write' }, steps: PAGES_DEPLOY_STEPS } } }
    assert.ok(validatePagesWorkflow(parsed).length > 0)
  })

  it('rejects missing deployment step id in Pages', () => {
    const deploySteps = [{ name: 'Deploy', uses: 'actions/deploy-pages@v5' }] // missing id
    const parsed = { name: 'Deploy GitHub Pages', on: { push: { branches: ['main'] }, workflow_dispatch: null }, concurrency: { group: 'pages', 'cancel-in-progress': true }, jobs: { build: { 'runs-on': 'ubuntu-latest', permissions: { contents: 'read', pages: 'read' }, steps: PAGES_BUILD_STEPS }, deploy: { environment: { name: 'github-pages', url: DEPLOYMENT_EXPR }, 'runs-on': 'ubuntu-latest', needs: 'build', permissions: { pages: 'write', 'id-token': 'write' }, steps: deploySteps } } }
    assert.ok(validatePagesWorkflow(parsed).length > 0)
  })

  it('rejects expression in Pages run field', () => {
    const steps = [...PAGES_BUILD_STEPS.slice(0, 2), { run: `echo ${DEPLOYMENT_EXPR}` }, ...PAGES_BUILD_STEPS.slice(2)]
    const parsed = { name: 'Deploy GitHub Pages', on: { push: { branches: ['main'] }, workflow_dispatch: null }, concurrency: { group: 'pages', 'cancel-in-progress': true }, jobs: { build: { 'runs-on': 'ubuntu-latest', permissions: { contents: 'read', pages: 'read' }, steps }, deploy: { environment: { name: 'github-pages', url: DEPLOYMENT_EXPR }, 'runs-on': 'ubuntu-latest', needs: 'build', permissions: { pages: 'write', 'id-token': 'write' }, steps: PAGES_DEPLOY_STEPS } } }
    assert.ok(validatePagesWorkflow(parsed).length > 0)
  })

  it('rejects arbitrary workflow/job names and self-hosted runners', () => {
    const ci = {
      name: 'Arbitrary',
      on: { push: { branches: ['main'] }, pull_request: { branches: ['main'] } },
      jobs: { quality: {
        name: 'Arbitrary job', 'runs-on': 'self-hosted', permissions: { contents: 'read' }, steps: CI_STEPS,
      } },
    }
    const ciErrors = validateCiWorkflow(ci)
    assert.ok(ciErrors.some(e => e.includes('CI name')))
    assert.ok(ciErrors.some(e => e.includes('CI job name')))
    assert.ok(ciErrors.some(e => e.includes('CI runs-on')))

    const pages = {
      name: 'Arbitrary',
      on: { push: { branches: ['main'] }, workflow_dispatch: null },
      concurrency: { group: 'pages', 'cancel-in-progress': true },
      jobs: {
        build: { 'runs-on': 'self-hosted', permissions: { contents: 'read', pages: 'read' }, steps: PAGES_BUILD_STEPS },
        deploy: {
          environment: { name: 'github-pages', url: DEPLOYMENT_EXPR }, 'runs-on': 'self-hosted', needs: 'build',
          permissions: { pages: 'write', 'id-token': 'write' }, steps: PAGES_DEPLOY_STEPS,
        },
      },
    }
    const pageErrors = validatePagesWorkflow(pages)
    assert.ok(pageErrors.some(e => e.includes('Pages name')))
    assert.ok(pageErrors.some(e => e.includes('Build runs-on')))
    assert.ok(pageErrors.some(e => e.includes('Deploy runs-on')))
  })

  it('rejects extra workflow file', async () => {
    const files = (await readdir(workflowDir)).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    assert.deepEqual(files.sort(), [...ALLOWED_FILES].sort())
  })

  // Real workflow validation

  it('ci.yml passes exact structural validation', async () => {
    const content = await readFile(join(workflowDir, 'ci.yml'), 'utf8')
    const parsed = parseStrict(content, 'ci.yml')
    const errs = validateCiWorkflow(parsed)
    assert.equal(errs.length, 0, `ci.yml errors:\n${errs.join('\n')}`)
  })

  it('pages.yml passes exact structural validation', async () => {
    const content = await readFile(join(workflowDir, 'pages.yml'), 'utf8')
    const parsed = parseStrict(content, 'pages.yml')
    const errs = validatePagesWorkflow(parsed)
    assert.equal(errs.length, 0, `pages.yml errors:\n${errs.join('\n')}`)
  })
})
