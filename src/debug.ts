import { editionDebugOptions, startEditionDebug } from '@motionstudies/three/debug'
import release from './editions/data-release.json' with { type: 'json' }

export const gpuDebugEnabled = (() => { const options = editionDebugOptions(); return options.perf || options.capture })()
let state: Record<string, unknown> = {}
export function updateEditionDebugState(next: Record<string, unknown>) { if (gpuDebugEnabled) state = next }
export const initializeEditionDebug = () => startEditionDebug({
  edition: 'gleislicht', build: __EDITION_BUILD__, metadata: () => ({ dataRelease: release.id, ...state }),
})
