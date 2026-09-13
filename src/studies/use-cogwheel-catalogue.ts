import { useEffect, useMemo, useState } from 'react'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import { editionDataUrl } from '../editions/data-url.ts'
import type { CogwheelCatalogue } from './cogwheel.ts'

export function useCogwheelCatalogue(enabled: boolean, snapshot?: NetworkSnapshot) {
  const feedVersion = snapshot?.metadata.feedVersion
  const serviceDate = snapshot?.metadata.serviceDate
  const key = enabled && feedVersion && serviceDate ? `${feedVersion}:${serviceDate}` : undefined
  const [state, setState] = useState<{ key: string; catalogue?: CogwheelCatalogue; tools?: typeof import('./cogwheel-runtime.ts'); error?: boolean }>()
  useEffect(() => {
    if (!key || !feedVersion || !serviceDate) return
    const controller = new AbortController()
    void Promise.all([
      fetch(editionDataUrl('swiss-cogwheel-catalogue.json'), { signal: controller.signal }),
      import('./cogwheel-runtime.ts'),
    ])
      .then(async ([response, tools]) => {
        if (!response.ok) throw new Error('Cogwheel catalogue unavailable')
        const catalogue: unknown = await response.json()
        if (!tools.compatibleCogwheelCatalogue(catalogue, { feedVersion, serviceDate })) throw new Error('Cogwheel catalogue mismatch')
        if (!controller.signal.aborted) setState({ key, catalogue, tools })
      })
      .catch(() => { if (!controller.signal.aborted) setState({ key, error: true }) })
    return () => controller.abort()
  }, [key, feedVersion, serviceDate])
  const current = key && state?.key === key ? state : undefined
  const network = useMemo(() => {
    if (!enabled || !snapshot) return undefined
    // Keep unrelated national stops hidden while the selected catalogue loads.
    return current?.tools ? current.tools.cogwheelNetwork(snapshot, current.catalogue)
      : { ...snapshot, trains: [], stops: [], edges: [], edgePaths: undefined }
  }, [enabled, snapshot, current])
  return { catalogue: current?.catalogue, error: current?.error, network }
}
