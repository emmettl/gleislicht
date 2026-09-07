import { useEffect, useState } from 'react'
import type { TransitOperationsSnapshot } from '@motionstudies/core/domain/operations'

export interface ObservedOperationsState {
  readonly snapshot?: TransitOperationsSnapshot
  readonly loading: boolean
  readonly error: boolean
}

interface EndpointState extends ObservedOperationsState {
  readonly endpoint: string
}

/** Poll after each response settles, retaining only the current source's data. */
export function useObservedOperations(
  endpoint: string,
  enabled: boolean,
  refreshMilliseconds = 30_000,
): ObservedOperationsState {
  if (!Number.isFinite(refreshMilliseconds) || refreshMilliseconds <= 0) {
    throw new Error('Observation refresh interval must be positive')
  }
  const [stored, setStored] = useState<EndpointState>({ endpoint, loading: false, error: false })
  const state = stored.endpoint === endpoint ? stored : { endpoint, loading: false, error: false }
  if (stored.endpoint !== endpoint) setStored(state)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let refresh: number | undefined
    function update(patch: Partial<ObservedOperationsState>) {
      if (!controller.signal.aborted) {
        setStored((current) => current.endpoint === endpoint ? { ...current, ...patch } : current)
      }
    }
    const load = async () => {
      update({ loading: true })
      try {
        const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error(`Observed operations returned ${response.status}`)
        const snapshot = await response.json() as TransitOperationsSnapshot
        update({ snapshot, error: false })
      } catch {
        update({ error: true })
      } finally {
        update({ loading: false })
        if (!controller.signal.aborted) refresh = window.setTimeout(() => void load(), refreshMilliseconds)
      }
    }
    void load()
    return () => {
      controller.abort()
      window.clearTimeout(refresh)
    }
  }, [enabled, endpoint, refreshMilliseconds])

  return { snapshot: state.snapshot, loading: enabled && state.loading, error: state.error }
}
