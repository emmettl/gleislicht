import { useEffect, useMemo, useState } from 'react'
import type { DataUrlResolver } from './data-url.ts'

interface ChunkDescriptor {
  readonly id: string
  readonly path: string
}

interface ChunkManifest<Descriptor extends ChunkDescriptor> {
  readonly chunks: readonly Descriptor[]
}

export interface ProgressiveChunkAdapter<Manifest, Descriptor, Chunk> {
  readonly chunkForTime: (manifest: Manifest, time: number) => Descriptor
  readonly adjacentChunks: (manifest: Manifest, current: Descriptor) => readonly Descriptor[]
  readonly readChunk: (response: Response, descriptor: Descriptor) => Promise<Chunk>
  readonly optional?: boolean
}

interface ResourceState<Manifest, Chunk> {
  readonly key: string
  readonly manifest?: Manifest
  readonly chunks: Readonly<Record<string, Chunk>>
  readonly manifestError?: boolean
  readonly unavailable?: boolean
  readonly failedChunk?: string
}

/** Internal lifecycle shared by the network, aircraft and road loaders. */
export function useProgressiveChunks<
  Descriptor extends ChunkDescriptor,
  Manifest extends ChunkManifest<Descriptor>,
  Chunk,
>(
  manifestFile: string,
  active: boolean,
  time: number,
  resolveAssetUrl: DataUrlResolver,
  adapter: ProgressiveChunkAdapter<Manifest, Descriptor, Chunk>,
) {
  const key = resolveAssetUrl(manifestFile)
  const [stored, setStored] = useState<ResourceState<Manifest, Chunk>>({ key, chunks: {} })
  // Reset during render so no effect (or consumer) sees another source's data.
  // Late responses are also rejected below, independently of fetch cancellation.
  const state: ResourceState<Manifest, Chunk> = stored.key === key ? stored : { key, chunks: {} }
  if (stored.key !== key) setStored(state)
  const { manifest, chunks, manifestError, unavailable, failedChunk } = state
  const descriptor = useMemo(
    () => manifest?.chunks.length ? adapter.chunkForTime(manifest, time) : undefined,
    [adapter, manifest, time],
  )
  const chunk = descriptor ? chunks[descriptor.id] : undefined
  const chunkReady = chunk !== undefined
  const error = Boolean(manifestError || (descriptor && failedChunk === descriptor.id))

  useEffect(() => {
    if (!active || manifest || unavailable) return
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch(key, { signal: controller.signal })
        if (adapter.optional && response.status === 404) {
          if (!controller.signal.aborted) {
            setStored((current) => current.key === key ? { ...current, unavailable: true } : current)
          }
          return
        }
        if (!response.ok) throw new Error(`Day manifest returned ${response.status}`)
        const next = await response.json() as Manifest
        if (!Array.isArray(next.chunks) || !next.chunks.length) {
          throw new Error('Day manifest has no chunks')
        }
        if (!controller.signal.aborted) {
          setStored((current) => current.key === key
            ? { ...current, manifest: next, manifestError: false }
            : current)
        }
      } catch {
        if (!controller.signal.aborted) {
          setStored((current) => current.key === key ? { ...current, manifestError: true } : current)
        }
      }
    })()
    return () => controller.abort()
  }, [active, adapter, key, manifest, unavailable])

  useEffect(() => {
    if (!active || !manifest || !descriptor) return
    const currentMissing = chunks[descriptor.id] === undefined
    const targets = currentMissing
      ? [descriptor]
      : adapter.adjacentChunks(manifest, descriptor).filter((candidate) => chunks[candidate.id] === undefined)
    if (!targets.length) return
    const controller = new AbortController()
    // Keep successful prefetches even when a neighbouring chunk fails.
    for (const candidate of targets) {
      void (async () => {
        try {
          const response = await fetch(resolveAssetUrl(candidate.path), { signal: controller.signal })
          if (!response.ok) throw new Error(`Day chunk returned ${response.status}`)
          const next = await adapter.readChunk(response, candidate)
          if (!controller.signal.aborted) {
            setStored((current) => current.key === key
              ? { ...current, chunks: { ...current.chunks, [candidate.id]: next },
                  failedChunk: current.failedChunk === candidate.id ? undefined : current.failedChunk }
              : current)
          }
        } catch {
          if (!controller.signal.aborted && currentMissing) {
            setStored((current) => current.key === key ? { ...current, failedChunk: candidate.id } : current)
          }
        }
      })()
    }
    return () => controller.abort()
  }, [active, adapter, chunks, descriptor, key, manifest, resolveAssetUrl])

  return {
    manifest,
    chunk,
    chunkReady,
    loading: active && !unavailable && !error && (!manifest || !chunkReady),
    unavailable: Boolean(unavailable),
    error,
  }
}
