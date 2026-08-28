/**
 * Preview lifecycle tests — consolidated.
 * Ephemeral ports, independent finally, detached-group owner fixtures.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer, createConnection } from 'node:net'
import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnPreview, killPreview, createCleanup } from './preview-shutdown.mjs'

function allocatePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)) })
    srv.on('error', reject)
  })
}

function portOpen(p) {
  return new Promise((resolve) => {
    const c = createConnection({ port: p, host: '127.0.0.1' })
    c.on('connect', () => { c.destroy(); resolve(true) })
    c.on('error', () => resolve(false))
  })
}

async function waitForPort(p, ms = 15_000) {
  const dl = Date.now() + ms
  while (Date.now() < dl) { if (await portOpen(p)) return true; await new Promise(r => setTimeout(r, 100)) }
  return false
}

async function waitForPortClosed(p, ms = 8_000) {
  const dl = Date.now() + ms
  while (Date.now() < dl) { if (!(await portOpen(p))) return true; await new Promise(r => setTimeout(r, 100)) }
  return false
}

function emergencyKill(child) { if (child?.pid) try { process.kill(child.pid, 'SIGKILL') } catch {} }
function emergencyKillGroup(pid) { if (pid) try { process.kill(-pid, 'SIGKILL') } catch {} }

describe('preview-lifecycle', () => {
  it('spawnPreview rejects on missing entry script', async () => {
    await assert.rejects(
      () => spawnPreview({ port: 1, entry: '/nonexistent/vite.js' }),
      (e) => { assert.ok(e.message.includes('spawnPreview')); return true },
    )
  })

  it('spawnPreview rejects on missing executable', async () => {
    await assert.rejects(
      () => spawnPreview({ port: 1, execPath: '/nonexistent/bin' }),
      (e) => { assert.ok(e.message.includes('spawnPreview')); return true },
    )
  })

  it('spawnPreview contains combined callback and executable failures', async () => {
    const probe = `
import { spawnPreview } from ${JSON.stringify(new URL('./preview-shutdown.mjs', import.meta.url).href)};
try {
  await spawnPreview({
    port: 1,
    execPath: '/nonexistent/bin',
    onChild: () => { throw new Error('callback failed') },
  });
} catch (error) {
  if (error.message !== 'callback failed') process.exit(2);
  setTimeout(() => process.exit(0), 100);
}
`
    const child = spawn(process.execPath, ['--input-type=module', '-e', probe], {
      cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
    })
    const code = await new Promise((resolve) => child.once('exit', resolve))
    assert.equal(code, 0, 'Combined failure caused an unhandled ChildProcess error')
  })

  it('spawnPreview handles child errors during the post-spawn handshake', async () => {
    const p = await allocatePort()
    let child
    try {
      await assert.rejects(
        () => spawnPreview({
          port: p,
          onChild: (owned) => {
            child = owned
            setTimeout(() => owned.emit('error', new Error('injected handshake error')), 50)
          },
        }),
        /spawnPreview failed: injected handshake error/,
      )
    } finally { emergencyKill(child) }
  })

  it('spawnPreview + killPreview starts and stops Vite, frees port', async () => {
    const p = await allocatePort()
    let child
    try {
      child = (await spawnPreview({ port: p })).child
      assert.ok(await waitForPort(p), 'Did not bind')
      await killPreview(child)
      assert.ok(await waitForPortClosed(p), 'Port not freed')
      assert.ok(child.exitCode !== null || child.signalCode !== null)
    } finally { emergencyKill(child) }
  })

  it('killPreview safe when already exited', async () => {
    const child = spawn('node', ['-e', 'process.exit(0)'], { stdio: ['ignore', 'pipe', 'pipe'] })
    await new Promise(r => child.once('exit', r))
    await killPreview(child) // must not throw
  })

  it('killPreview escalates to SIGKILL for SIGTERM-ignoring child', async () => {
    const p = await allocatePort()
    let child
    try {
      child = spawn('node', ['-e', `
        process.on('SIGTERM', () => {});
        require('net').createServer().listen(${p}, '127.0.0.1');
        setTimeout(() => {}, 120000);
      `], { stdio: ['ignore', 'pipe', 'pipe'] })
      await new Promise(r => child.once('spawn', r))
      assert.ok(await waitForPort(p), 'Did not bind')
      await killPreview(child)
      assert.ok(await waitForPortClosed(p), 'Port not freed after SIGKILL')
      assert.ok(child.exitCode !== null || child.signalCode !== null)
    } finally { emergencyKill(child) }
  })

  it('killPreview does not return early when kill() returns false', async () => {
    let child
    try {
      child = spawn('node', ['-e', 'setTimeout(()=>{},60000)'], { stdio: ['ignore', 'pipe', 'pipe'] })
      await new Promise(r => child.once('spawn', r))
      const realKill = child.kill.bind(child)
      let firstCall = true
      child.kill = function (sig) {
        if (firstCall) { firstCall = false; return false }
        return realKill(sig)
      }
      await killPreview(child)
      assert.ok(child.exitCode !== null || child.signalCode !== null,
        'killPreview returned but child not exited — fail-closed violated')
    } finally { emergencyKill(child) }
  })

  it('owner SIGTERM during spawn handshake retires the transferred child', async () => {
    const p = await allocatePort()
    let tmpDir = null
    let owner = null
    try {
      tmpDir = await mkdtemp(join(tmpdir(), 'prev-handshake-'))
      const entry = join(tmpDir, 'fast-entry.mjs')
      const script = join(tmpDir, 'owner.mjs')
      const helper = join(process.cwd(), 'scripts', 'preview-shutdown.mjs')
      await writeFile(entry, `
import { createServer } from 'node:net';
const args = process.argv;
const port = Number(args[args.indexOf('--port') + 1]);
createServer().listen(port, '127.0.0.1');
setTimeout(() => {}, 120000);
`)
      await writeFile(script, `
import { spawnPreview, createCleanup } from '${helper}';
let lifecycle;
try {
  await spawnPreview({ port: ${p}, entry: '${entry}', onChild: (child) => {
    lifecycle = createCleanup(child);
    lifecycle.installSignals();
  }});
  await new Promise(r => setTimeout(r, 120000));
} finally {
  lifecycle?.deregisterSignals();
  await lifecycle?.cleanup();
}
`)
      owner = spawn(process.execPath, [script], {
        cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
      })
      await new Promise(r => owner.once('spawn', r))
      assert.ok(await waitForPort(p), 'Handshake child did not bind')
      process.kill(owner.pid, 'SIGTERM')
      const code = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 5000)
        owner.once('exit', (value) => { clearTimeout(timeout); resolve(value) })
      })
      assert.equal(code, 143)
      assert.ok(await waitForPortClosed(p), 'Handshake child survived owner SIGTERM')
    } finally {
      if (owner?.pid) emergencyKillGroup(owner.pid)
      if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('owner SIGTERM awaits cleanup, exits 143, frees port', async () => {
    const p = await allocatePort()
    let tmpDir = null
    let lc = null
    try {
      tmpDir = await mkdtemp(join(tmpdir(), 'prev-'))
      const script = join(tmpDir, 'owner.mjs')
      const helper = join(process.cwd(), 'scripts', 'preview-shutdown.mjs')
      await writeFile(script, `
import { spawnPreview, createCleanup } from '${helper}';
const { child } = await spawnPreview({ port: ${p} });
const { cleanup, installSignals, deregisterSignals } = createCleanup(child);
installSignals();
try { await new Promise(r => setTimeout(r, 120000)); }
finally { deregisterSignals(); await cleanup(); }
`)
      lc = spawn('node', [script], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], detached: true })
      await new Promise(r => lc.once('spawn', r))
      assert.ok(await waitForPort(p), 'Preview did not bind')

      process.kill(lc.pid, 'SIGTERM')
      const exitCode = await new Promise((resolve) => {
        if (lc.exitCode !== null) return resolve(lc.exitCode)
        const t = setTimeout(() => { lc.removeListener('exit', f); resolve(null) }, 10_000)
        function f(code) { clearTimeout(t); resolve(code) }
        lc.once('exit', f)
      })
      assert.equal(exitCode, 143, `Expected exit 143, got ${exitCode}`)
      assert.ok(await waitForPortClosed(p), 'Port still listening after owner SIGTERM')
    } finally {
      if (lc?.pid) { try { process.kill(lc.pid, 'SIGTERM') } catch {} await new Promise(r => setTimeout(r, 300)); emergencyKillGroup(lc.pid) }
      await new Promise(r => setTimeout(r, 200))
      if (tmpDir) try { await rm(tmpDir, { recursive: true, force: true }) } catch {}
    }
  })

  it('killPreview contract: returns implies child exited', async () => {
    const p = await allocatePort()
    let child
    try {
      child = spawn('node', ['-e', `require('net').createServer().listen(${p},'127.0.0.1');setTimeout(()=>{},60000)`], { stdio: ['ignore', 'pipe', 'pipe'] })
      await new Promise(r => child.once('spawn', r))
      assert.ok(await waitForPort(p))
      await killPreview(child)
      assert.ok(child.exitCode !== null || child.signalCode !== null)
    } finally { emergencyKill(child) }
  })

  it('cleanup with a fast browser close leaves no timeout handle behind', async () => {
    let tmpDir = null
    let owner = null
    try {
      tmpDir = await mkdtemp(join(tmpdir(), 'prev-fast-close-'))
      const script = join(tmpDir, 'fast-close.mjs')
      const helper = join(process.cwd(), 'scripts', 'preview-shutdown.mjs')
      await writeFile(script, `
import { spawn } from 'node:child_process';
import { createCleanup } from '${helper}';
const child = spawn(process.execPath, ['-e', 'process.exit(0)']);
await new Promise(r => child.once('exit', r));
const { cleanup } = createCleanup(child, { getBrowser: () => ({ close: async () => {} }) });
await cleanup();
`)
      const started = Date.now()
      owner = spawn(process.execPath, [script], { stdio: ['ignore', 'pipe', 'pipe'] })
      const code = await new Promise((resolve) => owner.once('exit', resolve))
      const elapsed = Date.now() - started
      assert.equal(code, 0)
      assert.ok(elapsed < 1500, `Fast cleanup retained a timeout handle for ${elapsed}ms`)
    } finally {
      emergencyKill(owner)
      if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('hanging browser close is bounded and still retires preview', async () => {
    const p = await allocatePort()
    let child
    try {
      child = (await spawnPreview({ port: p })).child
      assert.ok(await waitForPort(p), 'Preview did not bind')
      const { cleanup } = createCleanup(child, {
        getBrowser: () => ({ close: () => new Promise(() => {}) }),
      })
      const started = Date.now()
      await cleanup()
      const elapsed = Date.now() - started
      assert.ok(elapsed < 9000, `Cleanup exceeded bounded window: ${elapsed}ms`)
      assert.ok(await waitForPortClosed(p), 'Preview survived hanging browser close')
    } finally { emergencyKill(child) }
  })

  it('second signal kills preview before forcing owner exit', async () => {
    const p = await allocatePort()
    let tmpDir = null
    let owner = null
    try {
      tmpDir = await mkdtemp(join(tmpdir(), 'prev-second-signal-'))
      const script = join(tmpDir, 'owner.mjs')
      const helper = join(process.cwd(), 'scripts', 'preview-shutdown.mjs')
      await writeFile(script, `
import { spawnPreview, createCleanup } from '${helper}';
const { child } = await spawnPreview({ port: ${p} });
const { cleanup, installSignals, deregisterSignals } = createCleanup(child, {
  getBrowser: () => ({ close: () => new Promise(() => {}) }),
});
installSignals();
try { await new Promise(r => setTimeout(r, 120000)); }
finally { deregisterSignals(); await cleanup(); }
`)
      owner = spawn(process.execPath, [script], {
        cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
      })
      await new Promise(r => owner.once('spawn', r))
      assert.ok(await waitForPort(p), 'Preview did not bind')
      process.kill(owner.pid, 'SIGTERM')
      await new Promise(r => setTimeout(r, 150))
      process.kill(owner.pid, 'SIGINT')
      const code = await new Promise((resolve) => {
        if (owner.exitCode !== null) return resolve(owner.exitCode)
        const t = setTimeout(() => resolve(null), 5000)
        owner.once('exit', (value) => { clearTimeout(t); resolve(value) })
      })
      assert.equal(code, 130, `Expected forced SIGINT exit 130, got ${code}`)
      assert.ok(await waitForPortClosed(p), 'Preview survived second signal')
    } finally {
      if (owner?.pid) emergencyKillGroup(owner.pid)
      if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
    }
  })
})
