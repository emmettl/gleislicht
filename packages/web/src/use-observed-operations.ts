import { useEffect, useState } from 'react'
import type { TransitOperationsSnapshot } from '@motionstudies/core/domain/operations.ts'

export interface ObservedOperationsState {
  readonly snapshot?: TransitOperationsSnapshot
  readonly loading: boolean
  readonly error: boolean
}

export function useObservedOperations(
  endpoint: string,
  enabled: boolean,
  refreshMilliseconds = 30_000,
): ObservedOperationsState {
  const [snapshot, setSnapshot] = useState<TransitOperationsSnapshot>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let active = true

    const load = async () => {
      setLoading(true)
      try {
        const response = await fetch(endpoint, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Observed operations returned ${response.status}`)
        }
        const next = (await response.json()) as TransitOperationsSnapshot
        if (!active) return
        setSnapshot(next)
        setError(false)
      } catch (loadError: unknown) {
        if (
          loadError instanceof DOMException &&
          loadError.name === 'AbortError'
        ) {
          return
        }
        console.error('Unable to load observed operations', loadError)
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    const refresh = window.setInterval(() => void load(), refreshMilliseconds)
    return () => {
      active = false
      controller.abort()
      window.clearInterval(refresh)
    }
  }, [enabled, endpoint, refreshMilliseconds])

  return { snapshot, loading, error }
}
