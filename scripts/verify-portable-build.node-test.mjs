import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const verifier = resolve('scripts/verify-portable-build.mjs')
const documentHtml = (head) => `<!doctype html><html lang="en"><head>${head}</head><body><div id="root"></div></body></html>`

async function runWithHtml(html, files = [], directories = [], symlinks = [], base = '/reviewline-webmcp/') {
  const directory = await mkdtemp(join(tmpdir(), 'reviewline-portable-'))
  try {
    await mkdir(join(directory, 'dist'))
    await writeFile(join(directory, 'dist/index.html'), documentHtml(html))
    for (const [relativePath, content = 'fixture'] of files) {
      const path = join(directory, 'dist', relativePath)
      await mkdir(resolve(path, '..'), { recursive: true })
      await writeFile(path, content)
    }
    for (const relativePath of directories) {
      await mkdir(join(directory, 'dist', relativePath), { recursive: true })
    }
    for (const [relativePath, target] of symlinks) {
      const path = join(directory, 'dist', relativePath)
      await mkdir(resolve(path, '..'), { recursive: true })
      await symlink(target, path)
    }
    return spawnSync(process.execPath, [verifier, base], {
      cwd: directory,
      encoding: 'utf8',
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('requires real JavaScript and CSS files under the exact project base', async () => {
  const onlyScripts = await runWithHtml(`
    <script src="/reviewline-webmcp/assets/a.js"></script>
    <script src="/reviewline-webmcp/assets/b.js"></script>
  `, [['assets/a.js'], ['assets/b.js']])
  assert.notEqual(onlyScripts.status, 0)

  const onlyStyles = await runWithHtml(`
    <link rel="stylesheet" href="/reviewline-webmcp/assets/a.css">
    <link rel="stylesheet" href="/reviewline-webmcp/assets/b.css">
  `, [['assets/a.css'], ['assets/b.css']])
  assert.notEqual(onlyStyles.status, 0)

  const imageAndFont = await runWithHtml(`
    <script src="/reviewline-webmcp/assets/logo.png"></script>
    <link rel="stylesheet" href="/reviewline-webmcp/assets/font.woff2">
  `, [['assets/logo.png'], ['assets/font.woff2']])
  assert.notEqual(imageAndFont.status, 0)

  const wrongBase = await runWithHtml(`
    <script src="/wrong/assets/app.js"></script>
    <link rel="stylesheet" href="/wrong/assets/app.css">
  `, [['assets/app.js'], ['assets/app.css']])
  assert.notEqual(wrongBase.status, 0)

  const absentAssets = await runWithHtml(`
    <script src="/reviewline-webmcp/assets/app.js"></script>
    <link rel="stylesheet" href="/reviewline-webmcp/assets/app.css">
  `)
  assert.notEqual(absentAssets.status, 0)

  const traversal = await runWithHtml(`
    <script src="/reviewline-webmcp/../assets/app.js"></script>
    <link rel="stylesheet" href="/reviewline-webmcp/../assets/app.css">
  `, [['assets/app.js'], ['assets/app.css']])
  assert.notEqual(traversal.status, 0)

  const traversalWithinAssets = await runWithHtml(`
    <script src="/reviewline-webmcp/assets/../app.js"></script>
    <link rel="stylesheet" href="/reviewline-webmcp/assets/../app.css">
  `, [['app.js'], ['app.css']])
  assert.notEqual(traversalWithinAssets.status, 0)

  for (const suffix of ['%2e%2e/app.js', '%2fapp.js', 'app.js?x=1', 'app.js#x']) {
    const malformed = await runWithHtml(`
      <script src="/reviewline-webmcp/assets/${suffix}"></script>
      <link rel="stylesheet" href="/reviewline-webmcp/assets/app.css">
    `, [['assets/app.css'], ['assets/app.js']])
    assert.notEqual(malformed.status, 0)
  }

  const directories = await runWithHtml(`
    <script src="/reviewline-webmcp/assets/app.js"></script>
    <link rel="stylesheet" href="/reviewline-webmcp/assets/app.css">
  `, [], ['assets/app.js', 'assets/app.css'])
  assert.notEqual(directories.status, 0)

  const symlinkEscape = await runWithHtml(`
    <script src="/reviewline-webmcp/assets/app.js"></script>
    <link rel="stylesheet" href="/reviewline-webmcp/assets/app.css">
  `, [['../outside/app.js'], ['../outside/app.css']], [], [
    ['assets/app.js', '../../outside/app.js'],
    ['assets/app.css', '../../outside/app.css'],
  ])
  assert.notEqual(symlinkEscape.status, 0)

  const complete = await runWithHtml(`
    <script type="module" src="/reviewline-webmcp/assets/app.js"></script>
    <link rel="stylesheet" href="/reviewline-webmcp/assets/app.css">
  `, [['assets/app.js'], ['assets/app.css']])
  assert.equal(complete.status, 0, complete.stderr)
})

test('rejects every unverified executable or stylesheet reference in mixed HTML', async () => {
  const validFiles = [['assets/app.js'], ['assets/app.css']]
  const validPair = `
    <script src="/reviewline-webmcp/assets/app.js"></script>
    <link rel="stylesheet" href="/reviewline-webmcp/assets/app.css">
  `
  const cases = [
    `${validPair}<script src="https://example.com/external.js"></script>`,
    `${validPair}<link rel="stylesheet" href="https://example.com/external.css">`,
    `${validPair}<script src="/reviewline-webmcp/Assets/extra.js"></script>`,
    `${validPair}<script src='/reviewline-webmcp/assets/absent.js'></script>`,
    `${validPair}<link rel='stylesheet' href='/reviewline-webmcp/assets/absent.css'>`,
    `${validPair}<script>globalThis.unverified = true</script>`,
  ]
  for (const html of cases) {
    const result = await runWithHtml(html, validFiles)
    assert.notEqual(result.status, 0, `Should reject mixed unverified reference:\n${html}`)
  }
})

test('rejects active HTML and base-resolution bypasses', async () => {
  const validFiles = [['assets/app.js'], ['assets/app.css']]
  const validPair = `
    <script src="/reviewline-webmcp/assets/app.js"></script>
    <link rel="stylesheet" href="/reviewline-webmcp/assets/app.css">
  `
  const activeCases = [
    `${validPair}<link rel="modulepreload" href="https://example.com/module.js">`,
    `${validPair}<link rel="modulepreload" href="data:text/javascript,alert(1)">`,
    `${validPair}<link rel="preload" as="script" href="https://example.com/preload.js">`,
    `${validPair}<style>@import url(https://example.com/external.css);</style>`,
    `${validPair}<iframe srcdoc="<script>alert(1)</script>"></iframe>`,
    `${validPair}<a href="javascript:alert(1)">run</a>`,
    `${validPair}<div onclick="alert(1)"></div>`,
    `${validPair}<object data="https://example.com/doc"></object>`,
    `${validPair}<embed src="https://example.com/doc">`,
    `${validPair}<script src="/reviewline-webmcp/assets/app.js" src="https://example.com/duplicate.js"></script>`,
  ]
  for (const html of activeCases) {
    const result = await runWithHtml(html, validFiles)
    assert.notEqual(result.status, 0, `Should reject active content:\n${html}`)
  }

  const relativeWithExternalBase = `
    <base href="https://example.com/">
    <script src="./assets/app.js"></script>
    <link rel="stylesheet" href="./assets/app.css">
  `
  const baseResult = await runWithHtml(relativeWithExternalBase, validFiles, [], [], './')
  assert.notEqual(baseResult.status, 0, 'Should reject external base href in ./ mode')
})

test('rejects symlinked dist root pointing to external physical tree', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'reviewline-portable-'))
  try {
    // Create real tree outside dist
    await mkdir(join(directory, 'external', 'assets'), { recursive: true })
    await writeFile(join(directory, 'external', 'index.html'), documentHtml(`
      <script src="/reviewline-webmcp/assets/app.js"></script>
      <link rel="stylesheet" href="/reviewline-webmcp/assets/app.css">
    `))
    await writeFile(join(directory, 'external', 'assets', 'app.js'), 'fixture')
    await writeFile(join(directory, 'external', 'assets', 'app.css'), 'fixture')
    // Symlink dist → external
    await symlink(join(directory, 'external'), join(directory, 'dist'))
    const result = spawnSync(process.execPath, [verifier, '/reviewline-webmcp/'], {
      cwd: directory, encoding: 'utf8',
    })
    assert.notEqual(result.status, 0, 'Should reject symlinked dist root')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('rejects symlinked dist index.html', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'reviewline-portable-'))
  try {
    await mkdir(join(directory, 'dist', 'assets'), { recursive: true })
    await writeFile(join(directory, 'external.html'), documentHtml(`
      <script src="/reviewline-webmcp/assets/app.js"></script>
      <link rel="stylesheet" href="/reviewline-webmcp/assets/app.css">
    `))
    await symlink(join(directory, 'external.html'), join(directory, 'dist', 'index.html'))
    await writeFile(join(directory, 'dist', 'assets', 'app.js'), 'fixture')
    await writeFile(join(directory, 'dist', 'assets', 'app.css'), 'fixture')
    const result = spawnSync(process.execPath, [verifier, '/reviewline-webmcp/'], {
      cwd: directory, encoding: 'utf8',
    })
    assert.notEqual(result.status, 0, 'Should reject symlinked dist/index.html')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('rejects nested parent-directory symlink inside dist/assets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'reviewline-portable-'))
  try {
    await mkdir(join(directory, 'dist', 'assets', 'sub'), { recursive: true })
    // Real file at dist/assets/sub/app.js
    await writeFile(join(directory, 'dist', 'assets', 'sub', 'app.js'), 'fixture')
    await writeFile(join(directory, 'dist', 'assets', 'sub', 'app.css'), 'fixture')
    // Replace 'sub' directory with a symlink to parent (dist/assets/sub → dist/assets)
    await rm(join(directory, 'dist', 'assets', 'sub'), { recursive: true })
    await symlink(join(directory, 'dist', 'assets'), join(directory, 'dist', 'assets', 'sub'))
    await writeFile(join(directory, 'dist', 'index.html'), documentHtml(`
      <script src="/reviewline-webmcp/assets/sub/app.js"></script>
      <link rel="stylesheet" href="/reviewline-webmcp/assets/sub/app.css">
    `))
    // Place files at assets root so the symlinked sub/app.js resolves
    await writeFile(join(directory, 'dist', 'assets', 'app.js'), 'fixture')
    await writeFile(join(directory, 'dist', 'assets', 'app.css'), 'fixture')
    const result = spawnSync(process.execPath, [verifier, '/reviewline-webmcp/'], {
      cwd: directory, encoding: 'utf8',
    })
    assert.notEqual(result.status, 0, 'Should reject nested symlinked path component')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
