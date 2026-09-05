import { useEffect, useMemo, useState } from 'react'
import {
  adjacentAirDayChunks,
  airDayChunkForTime,
  airSnapshotForDayChunk,
} from './domain/air-day.ts'
import type { AirDayChunk, AirDayManifest } from './domain/air-day.ts'
import type { AirSnapshot } from './domain/air.ts'

interface ProgressiveAirDay {
  readonly manifest?: AirDayManifest
  readonly snapshot?: AirSnapshot
  readonly chunkReady: boolean
  readonly loading: boolean
  readonly error: boolean
}

export function useProgressiveAirDay(
  manifestFile: string,
  active: boolean,
  time: number,
): ProgressiveAirDay {
  const [manifest, setManifest] = useState<AirDayManifest>()
  const [chunks, setChunks] = useState<Readonly<Record<string, AirDayChunk>>>({})
  const [error, setError] = useState(false)
  const descriptor = useMemo(
    () => (manifest ? airDayChunkForTime(manifest, time) : undefined),
    [manifest, time],
  )
  const chunkReady = Boolean(descriptor && chunks[descriptor.id])
  const loading = active && !error && (!manifest || !chunkReady)
  const snapshot = useMemo(
    () =>
      manifest
        ? airSnapshotForDayChunk(
            manifest,
            descriptor ? chunks[descriptor.id] : undefined,
          )
        : undefined,
    [chunks, descriptor, manifest],
  )

  useEffect(() => {
    if (!active || manifest) return
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}data/${manifestFile}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Air day manifest returned ${response.status}`)
        return response.json() as Promise<AirDayManifest>
      })
      .then(setManifest)
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setError(true)
      })
    return () => controller.abort()
  }, [active, manifest, manifestFile])

  useEffect(() => {
    if (!active || !manifest || !descriptor) return
    const currentMissing = !chunks[descriptor.id]
    const targets = currentMissing
      ? [descriptor]
      : adjacentAirDayChunks(manifest, descriptor).filter(
          (candidate) => !chunks[candidate.id],
        )
    if (!targets.length) return

    const controller = new AbortController()
    Promise.all(
      targets.map(async (candidate) => {
        const response = await fetch(
          `${import.meta.env.BASE_URL}data/${candidate.path}`,
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error(`Air day chunk returned ${response.status}`)
        return [candidate.id, await response.json()] as const
      }),
    )
      .then((entries) => {
        setChunks((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }))
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        if (currentMissing) setError(true)
      })
    return () => controller.abort()
  }, [active, chunks, descriptor, manifest])

  return { manifest, snapshot, chunkReady, loading, error }
}
