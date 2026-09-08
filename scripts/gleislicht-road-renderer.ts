import type { Plugin } from 'vite'

/** Port allchange's stable badges and observation-independent road outlines.
 * The pinned alpha.4 renderer has no public road-label or baseline-style slot.
 * Fail on upstream hook changes instead of silently dropping these fixes.
 */
export function gleislichtRoadRenderer(): Plugin {
  return {
    name: 'gleislicht-roads', enforce: 'pre',
    transform(source, id) {
      if (!id.split('?')[0].replaceAll('\\', '/').endsWith('/@motionstudies/three/RoadTrafficLayer.js')) return
      let code = source
      const replace = (before: string, after: string) => {
        if (code.split(before).length !== 2) throw new Error(`Gleislicht road hook needs review: ${before}`)
        code = code.replace(before, after)
      }
      replace("import { nationalRoadConditionsAtTime, } from '@motionstudies/core/domain/road-day';",
        'import { nationalRoadConditionsAtTime } from "/src/studies/road-conditions.ts";')
      // Geometry stays visible with no observations, including during selection.
      replace('color: "#ffb36b", transparent: true, opacity: selectedRoadId ? 0.008 : subdued ? 0.018 : 0.062, blending: THREE.AdditiveBlending, depthWrite: false',
        'color: "#a0a6b2", transparent: true, opacity: selectedRoadId ? 0.25 : subdued ? 0.2 : 0.45, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false')
      replace('color: "#bc8058", transparent: true, opacity: selectedRoadId ? 0.003 : subdued ? 0.008 : 0.018, depthWrite: false',
        'color: "#a0a6b2", transparent: true, opacity: subdued ? 0.15 : 0.3, depthTest: false, depthWrite: false, toneMapped: false')
      replace('color: "#fff1cf", transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending',
        'color: "#a0a6b2", transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending')
      const topology = 'topology && (_jsx(RoadTopology, { snapshot: topology, projection: projection, subdued: subdued, selectedRoadId: selectedRoadId }))'
      replace(topology, `${topology}, topology && _jsx(GleislichtRoadLabels, { topology, projection, subdued, selectedRoadId })`)
      return { code: 'import { GleislichtRoadLabels } from "/src/studies/GleislichtRoadLabels.tsx";\n' + code, map: null }
    },
  }
}
