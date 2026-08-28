/**
 * Preview child-process lifecycle helper.
 *
 * Direct-child architecture: spawn Vite CLI as a single owned ChildProcess.
 * Manage exclusively through the handle (child.kill, exit/signal events).
 * No process groups, no raw PID operations.
 */
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'

const VITE_BIN = resolve('node_modules/vite/bin/vite.js')

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve(true)
    const timeout = setTimeout(() => { child.removeListener('exit', onExit); resolve(false) }, timeoutMs)
    function onExit() { clearTimeout(timeout); resolve(true) }
    child.once('exit', onExit)
  })
}

/**
 * Spawn Vite preview. Async — awaits spawn handshake or rejects on
 * error/immediate exit. entry/execPath seams allow test injection.
 */
export async function spawnPreview({ port, host = '127.0.0.1', entry, execPath, onChild }) {
  const bin = execPath ?? process.execPath
  const script = entry ?? VITE_BIN

  const child = spawn(bin, [script, 'preview', '--host', host, '--port', String(port), '--strictPort'], {
    cwd: process.cwd(), env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'],
  })

  let logBuf = ''
  child.stdout.on('data', (c) => { logBuf += c.toString(); if (logBuf.length > 8192) logBuf = logBuf.slice(-4096) })
  child.stderr.on('data', (c) => { logBuf += c.toString(); if (logBuf.length > 8192) logBuf = logBuf.slice(-4096) })

  // Install spawn/error/exit listeners before transferring ownership so a
  // callback exception cannot expose a later unhandled ChildProcess error.
  const handshake = new Promise((resolve, reject) => {
    let settled = false
    let timeout
    const clearHandshake = () => {
      if (timeout) clearTimeout(timeout)
      child.removeListener('spawn', onSpawn)
      child.removeListener('error', onError)
      child.removeListener('exit', onEarlyExit)
      child.removeListener('exit', onPostSpawnExit)
    }
    const succeed = () => {
      if (settled) return
      settled = true
      clearHandshake()
      resolve()
    }
    const fail = (error) => {
      if (settled) return
      settled = true
      clearHandshake()
      reject(error)
    }
    function onSpawn() {
      child.removeListener('exit', onEarlyExit)
      child.once('exit', onPostSpawnExit)
      timeout = setTimeout(succeed, 300)
    }
    function onPostSpawnExit(code, signal) {
      fail(new Error(`spawnPreview: child exited immediately (code=${code}, signal=${signal}).${logBuf ? '\n' + logBuf.slice(0, 1000) : ''}`))
    }
    function onError(err) {
      fail(new Error(`spawnPreview failed: ${err.message}`))
    }
    function onEarlyExit(code, signal) {
      fail(new Error(`spawnPreview: exited before spawn (code=${code}, signal=${signal}).${logBuf ? '\n' + logBuf.slice(0, 1000) : ''}`))
    }
    child.once('spawn', onSpawn)
    child.once('error', onError)
    child.once('exit', onEarlyExit)
  })

  // Transfer ownership synchronously in the initial call turn, then await the
  // already-protected handshake. Drain handshake rejection if callback fails.
  try {
    onChild?.(child)
  } catch (error) {
    child.kill('SIGKILL')
    handshake.catch(() => {})
    throw error
  }
  await handshake

  // Post-spawn: install bounded error collector so later errors don't become unhandled
  child.on('error', (err) => {
    logBuf += `\n[child error] ${err.message}`
    if (logBuf.length > 8192) logBuf = logBuf.slice(-4096)
  })

  return { child, log: () => logBuf }
}

/**
 * Kill an owned direct child. SIGTERM → 3s → SIGKILL → 2s → throw.
 * Does NOT return early when child.kill() returns false — waits boundedly
 * for exit event to prove retirement, since false can indicate a kernel race.
 */
export async function killPreview(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  if (child.pid == null) return

  // Phase 1: SIGTERM
  child.kill('SIGTERM')

  // Phase 2: bounded wait for exit
  const exited = await waitForExit(child, 3_000)
  if (exited) return

  // Phase 3: SIGKILL
  child.kill('SIGKILL')

  // Phase 4: bounded wait
  const killed = await waitForExit(child, 2_000)
  if (!killed) {
    throw new Error(`killPreview: child PID ${child.pid} did not exit after SIGKILL + 2s.`)
  }
}

/**
 * Idempotent cleanup + async signal handlers.
 *
 * Browser close is independently bounded (5s timeout) so a hanging browser
 * cannot delay child retirement. Vite child is ALWAYS killed in a finally
 * block regardless of browser outcome.
 *
 * Signal path: first signal awaits cleanup then exits 143/130.
 * Second signal synchronously kills child via handle, then forces owner exit.
 * Owner-external SIGKILL cannot be intercepted.
 */
export function createCleanup(previewChild, opts = {}) {
  let cleanupPromise = null
  const BROWSER_TIMEOUT = 5_000

  async function cleanup() {
    if (cleanupPromise) return cleanupPromise
    cleanupPromise = (async () => {
      // Browser close bounded independently — must not delay child retirement
      try {
        const b = opts.getBrowser?.()
        if (b) {
          let timeout
          try {
            await Promise.race([
              b.close(),
              new Promise((resolve) => { timeout = setTimeout(resolve, BROWSER_TIMEOUT) }),
            ])
          } finally {
            if (timeout) clearTimeout(timeout)
          }
        }
      } catch { /* ignore browser close errors/timeouts */ }
      // ALWAYS retire Vite regardless of browser outcome
      await killPreview(previewChild)
    })()
    return cleanupPromise
  }

  let handling = false

  function signalHandler(signal) {
    if (handling) {
      // Second signal — synchronous kill + forced exit
      previewChild.kill('SIGKILL')
      process.exit(128 + (signal === 'SIGTERM' ? 15 : 2))
    }
    handling = true
    process.removeListener('SIGTERM', signalHandler)
    process.removeListener('SIGINT', signalHandler)
    process.once('SIGTERM', signalHandler)
    process.once('SIGINT', signalHandler)

    // First signal: await bounded cleanup then exit
    cleanup().then(
      () => process.exit(128 + (signal === 'SIGTERM' ? 15 : 2)),
      (err) => {
        process.stderr.write(`Signal cleanup error: ${String(err?.message ?? err).slice(0, 200)}\n`)
        process.exit(1)
      },
    )
  }

  function installSignals() {
    process.on('SIGTERM', signalHandler)
    process.on('SIGINT', signalHandler)
  }

  function deregisterSignals() {
    handling = true
    process.removeListener('SIGTERM', signalHandler)
    process.removeListener('SIGINT', signalHandler)
  }

  return { cleanup, installSignals, deregisterSignals }
}
