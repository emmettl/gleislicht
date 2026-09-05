import { useEffect, useMemo, useState } from 'react'
import {
  adjacentRoadChunks,
  roadChunkForTime,
  roadSnapshotForChunk,
  type NationalRoadMinuteChunk,
  type NationalRoadStudyManifest,
} from './domain/road-day.ts'

export function useProgressiveRoadStudy(
  manifestFile: string,
  active: boolean,
  time: number,
) {
  const [manifest, setManifest] = useState<NationalRoadStudyManifest>()
  const [chunks, setChunks] = useState<
    Readonly<Record<string, NationalRoadMinuteChunk>>
  >({})
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState(false)
  const descriptor = useMemo(
    () => (manifest ? roadChunkForTime(manifest, time) : undefined),
    [manifest, time],
  )
  const chunkReady = Boolean(descriptor && chunks[descriptor.id])
  const snapshot = useMemo(
    () =>
      manifest
        ? roadSnapshotForChunk(
            manifest,
            descriptor ? chunks[descriptor.id] : undefined,
          )
        : undefined,
    [chunks, descriptor, manifest],
  )

  useEffect(() => {
    if (!active || manifest || unavailable) return
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}data/${manifestFile}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (response.status === 404) {
          setUnavailable(true)
          return undefined
        }
        if (!response.ok) {
          throw new Error(`National road manifest returned ${response.status}`)
        }
        return response.json() as Promise<NationalRoadStudyManifest>
      })
      .then((value) => {
        if (value) setManifest(value)
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setError(true)
      })
    return () => controller.abort()
  }, [active, manifest, manifestFile, unavailable])

  useEffect(() => {
    if (!active || !manifest || !descriptor) return
    const currentMissing = !chunks[descriptor.id]
    const targets = currentMissing
      ? [descriptor]
      : adjacentRoadChunks(manifest, descriptor).filter(
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
        if (!response.ok) {
          throw new Error(`National road chunk returned ${response.status}`)
        }
        return [candidate.id, await response.json()] as const
      }),
    )
      .then((entries) => {
        setChunks((current) => ({ ...current, ...Object.fromEntries(entries) }))
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        if (currentMissing) setError(true)
      })
    return () => controller.abort()
  }, [active, chunks, descriptor, manifest])

  return {
    manifest,
    snapshot,
    chunkReady,
    loading: active && !unavailable && !error && (!manifest || !chunkReady),
    unavailable,
    error,
  }
}
