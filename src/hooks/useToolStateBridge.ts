// useToolStateBridge — the transactional bridge between WebMCP tool execution and
// visible React state.
//
// A tool call only resolves after React has committed the state it produced, so
// the agent can never observe a result the human cannot yet see. Commits are
// acknowledged with a bounded layout-effect handshake rather than
// requestAnimationFrame, which browsers may suspend.
//
// MIT License

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { makeInitialState, resetCounters, type AppState } from '../domain/domain'
import { createSerializedStateTransactions, type RunStateTransaction } from '../tools/registration'

const COMMIT_TIMEOUT_MS = 2000

interface PendingToolCommit {
  nextState: AppState
  resolve: () => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export interface ToolStateBridge {
  state: AppState
  /** Read the latest committed state synchronously, outside the React render cycle. */
  getState: () => AppState
  /** Apply a reducer to committed state. */
  setState: (updater: (prev: AppState) => AppState) => void
  /** Serialized transaction runner handed to WebMCP tool handlers. */
  runToolTransaction: RunStateTransaction
  /** Discard the session and restore deterministic initial state. */
  reset: () => void
}

export function useToolStateBridge(): ToolStateBridge {
  const [state, setStateRaw] = useState<AppState>(() => makeInitialState())
  const stateRef = useRef<AppState>(state)
  const pendingCommitsRef = useRef<PendingToolCommit[]>([])

  useLayoutEffect(() => {
    stateRef.current = state
    const remaining: PendingToolCommit[] = []
    for (const pending of pendingCommitsRef.current) {
      if (pending.nextState === state) {
        clearTimeout(pending.timeout)
        pending.resolve()
      } else {
        remaining.push(pending)
      }
    }
    pendingCommitsRef.current = remaining
  }, [state])

  useEffect(
    () => () => {
      for (const pending of pendingCommitsRef.current) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('Tool state commit cancelled because Reviewline unmounted'))
      }
      pendingCommitsRef.current = []
    },
    [],
  )

  const setState = useCallback((updater: (prev: AppState) => AppState) => {
    setStateRaw((prev) => updater(prev))
  }, [])

  const getState = useCallback(() => stateRef.current, [])

  const commitToolState = useCallback((nextState: AppState): Promise<void> => {
    return new Promise((resolve, reject) => {
      const pending: PendingToolCommit = {
        nextState,
        resolve,
        reject,
        timeout: setTimeout(() => {
          pendingCommitsRef.current = pendingCommitsRef.current.filter(
            (candidate) => candidate !== pending,
          )
          setStateRaw(stateRef.current)
          reject(new Error('Timed out waiting for the Reviewline UI state to commit'))
        }, COMMIT_TIMEOUT_MS),
      }
      pendingCommitsRef.current.push(pending)
      setStateRaw(nextState)
    })
  }, [])

  const transactionsRef = useRef<RunStateTransaction | null>(null)
  if (!transactionsRef.current) {
    transactionsRef.current = createSerializedStateTransactions(getState, commitToolState)
  }

  const reset = useCallback(() => {
    resetCounters()
    setStateRaw(makeInitialState())
  }, [])

  return {
    state,
    getState,
    setState,
    runToolTransaction: transactionsRef.current,
    reset,
  }
}
