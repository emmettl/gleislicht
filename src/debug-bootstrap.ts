import { editionDebugOptions, startEditionDebug } from '@motionstudies/three/debug'
import release from './editions/data-release.json' with { type: 'json' }

/** Resolve debug policy through the shared API only after explicit opt-in. */
export async function initializeDebug() {
  const options = editionDebugOptions()
  if (!options.perf && !options.capture) return false
  await startEditionDebug({
    edition: 'gleislicht', build: __EDITION_BUILD__, metadata: () => ({ dataRelease: release.id }),
  })
  return true
}
