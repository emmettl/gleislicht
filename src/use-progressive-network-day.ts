import { useEffect, useMemo, useState } from 'react'
import {
  adjacentDayChunks,
  dayChunkForTime,
  networkSnapshotForDayChunk,
} from './domain/network-day.ts'
import type {
  NetworkDayChunk,
  NetworkDayChunkDescriptor,
  NetworkDayManifest,
  NetworkSnapshot,
} from './domain/network.ts'

export async function verifiedNetworkDayChunk(
  response: Response,
  descriptor: NetworkDayChunkDescriptor,
): Promise<NetworkDayChunk> {
  const bytes = await response.arrayBuffer()
  if (descriptor.bytes !== undefined && bytes.byteLength !== descriptor.bytes) {
    throw new Error(`Network day chunk ${descriptor.id} has an unexpected size`)
  }
  if (descriptor.sha256) {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const actual = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
    if (actual !== descriptor.sha256) {
      throw new Error(`Network day chunk ${descriptor.id} failed its integrity check`)
    }
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as NetworkDayChunk
}

interface ProgressiveNetworkDay {
  readonly manifest?: NetworkDayManifest
  readonly network?: NetworkSnapshot
  readonly chunkReady: boolean
  readonly loading: boolean
  readonly error: boolean
}

export function useProgressiveNetworkDay(
  manifestFile: string,
  active: boolean,
  time: number,
): ProgressiveNetworkDay {
  const [manifest, setManifest] = useState<NetworkDayManifest>()
  const [chunks, setChunks] = useState<Readonly<Record<string, NetworkDayChunk>>>({})
  const [error, setError] = useState(false)
  const descriptor = useMemo(
    () => (manifest ? dayChunkForTime(manifest, time) : undefined),
    [manifest, time],
  )
  const chunkReady = Boolean(descriptor && chunks[descriptor.id])
  const loading = active && !error && (!manifest || !chunkReady)
  const network = useMemo(
    () =>
      manifest
        ? networkSnapshotForDayChunk(
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
        if (!response.ok) {
          throw new Error(`Network day manifest returned ${response.status}`)
        }
        return response.json() as Promise<NetworkDayManifest>
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
      : adjacentDayChunks(manifest, descriptor).filter(
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
          throw new Error(`Network day chunk returned ${response.status}`)
        }
        return [
          candidate.id,
          await verifiedNetworkDayChunk(response, candidate),
        ] as const
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

  return { manifest, network, chunkReady, loading, error }
}
