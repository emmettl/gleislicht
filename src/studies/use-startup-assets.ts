import { useEffect, useState } from 'react'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import type { MapBoundary } from '@motionstudies/core/domain/boundary'
import type { MapWaterBodies } from '@motionstudies/core/domain/lakes'
import type { SwitzerlandEdition } from '../editions/switzerland.ts'
import { editionDataUrl } from '../editions/data-url.ts'

/** Owns the eager Swiss assets only. Optional map layers never gate playback.
 * Cleanup prevents obsolete responses and failures from reaching the current edition.
 * Playback time, user intent and all on-demand study loaders remain with their owners.
 */
export function useStartupAssets(data: Pick<SwitzerlandEdition['data'], 'nationalMorning' | 'boundary' | 'water'>) {
  const [nationalNetwork, setNationalNetwork] = useState<NetworkSnapshot>()
  const [boundary, setBoundary] = useState<MapBoundary>()
  const [lakes, setLakes] = useState<MapWaterBodies>()
  const [dataError, setDataError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch(editionDataUrl(data.nationalMorning), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`GTFS snapshot returned ${response.status}`)
        return response.json() as Promise<NetworkSnapshot>
      })
      .then((snapshot) => {
        if (!controller.signal.aborted) setNationalNetwork(snapshot)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return
        setDataError(true)
      })
    fetch(editionDataUrl(data.boundary), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Boundary snapshot returned ${response.status}`)
        return response.json() as Promise<MapBoundary>
      })
      .then(snapshot => { if (!controller.signal.aborted) setBoundary(snapshot) })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return
        console.warn('Unable to load the Swiss national boundary', error)
      })
    fetch(editionDataUrl(data.water), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Lake snapshot returned ${response.status}`)
        return response.json() as Promise<MapWaterBodies>
      })
      .then(snapshot => { if (!controller.signal.aborted) setLakes(snapshot) })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return
        console.warn('Unable to load the Swiss lake layer', error)
      })
    return () => controller.abort()
  }, [data.boundary, data.nationalMorning, data.water])

  return { nationalNetwork, boundary, lakes, dataError }
}
