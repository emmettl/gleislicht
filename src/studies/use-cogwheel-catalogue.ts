import { useEffect, useState } from 'react'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import { editionDataUrl } from '../editions/data-url.ts'
import { compatibleCogwheelCatalogue, type CogwheelCatalogue } from './cogwheel.ts'

export function useCogwheelCatalogue(enabled: boolean, snapshot?: NetworkSnapshot) {
  const feedVersion = snapshot?.metadata.feedVersion
  const serviceDate = snapshot?.metadata.serviceDate
  const key = enabled && feedVersion && serviceDate ? `${feedVersion}:${serviceDate}` : undefined
  const [state, setState] = useState<{ key: string; catalogue?: CogwheelCatalogue; error?: boolean }>()
  useEffect(() => {
    if (!key || !feedVersion || !serviceDate) return
    const controller = new AbortController()
    void fetch(editionDataUrl('swiss-cogwheel-catalogue.json'), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Cogwheel catalogue unavailable')
        const catalogue: unknown = await response.json()
        if (!compatibleCogwheelCatalogue(catalogue, { feedVersion, serviceDate })) throw new Error('Cogwheel catalogue mismatch')
        if (!controller.signal.aborted) setState({ key, catalogue })
      })
      .catch(() => { if (!controller.signal.aborted) setState({ key, error: true }) })
    return () => controller.abort()
  }, [key, feedVersion, serviceDate])
  return key && state?.key === key ? state : undefined
}
