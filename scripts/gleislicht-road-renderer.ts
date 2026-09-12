import type { Plugin } from 'vite'

/** Port allchange's stable badges and observation-independent road outlines.
 * The pinned alpha.4 renderer has no public road-label or baseline-style slot.
 * Fail on upstream hook changes instead of silently dropping these fixes.
 */
export function gleislichtRoadRenderer(): Plugin {
  return {
    name: 'gleislicht-roads', enforce: 'pre',
    transform(source, id) {
      const moduleId = id.split('?')[0].replaceAll('\\', '/')
      if (moduleId.endsWith('/@motionstudies/three/NationalNetworkScene.js')) {
        const imported = "import { RoadTrafficLayer } from './RoadTrafficLayer.js';"
        if (source.split(imported).length !== 2) throw new Error('Gleislicht deferred road layer hook needs review')
        // The opening rail map does not render roads. Keep their meshes and
        // geometry helpers deferred until a road snapshot or topology is shown.
        return { code: source.replace(imported, `import { lazy as lazyRoad, Suspense as RoadSuspense } from 'react';
const LazyRoadTrafficLayer = lazyRoad(() => import('./RoadTrafficLayer.js').then(module => ({ default: module.RoadTrafficLayer })));
const RoadTrafficLayer = props => _jsx(RoadSuspense, { fallback: null, children: _jsx(LazyRoadTrafficLayer, { ...props }) });`), map: null }
      }
      if (!moduleId.endsWith('/@motionstudies/three/RoadTrafficLayer.js')) return
      let code = source
      const replace = (before: string, after: string, count = 1) => {
        if (code.split(before).length !== count + 1) throw new Error(`Gleislicht road hook needs review: ${before}`)
        code = code.replaceAll(before, after)
      }
      replace("import { nationalRoadConditionsAtTime, } from '@motionstudies/core/domain/road-day';",
        'import { nationalRoadConditionsAtTime } from "/src/studies/road-conditions.ts";')
      replace(`const coordinates = topologySection.path ?? [
                topologySection.fromCoordinate,
                topologySection.toCoordinate,
            ];`, `const from = topology.sites.find(site => site.id === topologySection.fromSiteId)?.match;
            const to = topology.sites.find(site => site.id === topologySection.toSiteId)?.match;
            const coordinates = roadPathOnTopology(topology, section.road,
                from?.projectedCoordinate ?? topologySection.fromCoordinate,
                to?.projectedCoordinate ?? topologySection.toCoordinate,
                from?.segmentId, to?.segmentId);
            if (!coordinates || coordinates.length < 2) return [];`)
      replace("new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)", 'new RoadPolyline(points)', 2)
      replace('const points = corridor.path.map((coordinate) => projectRoadCoordinate(coordinate, projection));',
        `const coordinates = topology ? roadPathOnTopology(topology, corridor.road.replace(/^A/, 'N'), corridor.path[0], corridor.path.at(-1)) : undefined;
        if (!coordinates || coordinates.length < 2) return [];
        const points = coordinates.map((coordinate) => projectRoadCoordinate(coordinate, projection));`)
      replace('(snapshot?.corridors ?? []).map((corridor) => {', '(snapshot?.corridors ?? []).flatMap((corridor) => {')
      replace('[projection, snapshot?.corridors]', '[projection, snapshot?.corridors, topology]')
      replace('transform.position.x += direction.reverse ? -0.045 : 0.045;', '')
      replace("const aheadProgress = (progress + (direction.reverse ? -0.001 : 0.001) + 1) % 1;",
        'const aheadProgress = Math.max(0, Math.min(1, progress + (direction.reverse ? -0.001 : 0.001)));')
      // Per-segment IDs share the visible baseline, so no duplicate picking mesh is needed.
      replace('const mainlinePoints = [];', 'const mainlinePoints = [];\n        const pickRoads = [];')
      replace('target.push(first, second);', 'target.push(first, second);\n                if (path.mainline) pickRoads.push(path.road, path.road);')
      replace('mainline: new THREE.BufferGeometry().setFromPoints(mainlinePoints),',
        'mainline: Object.assign(new THREE.BufferGeometry().setFromPoints(mainlinePoints), { userData: { pickRoads } }),')
      // Geometry stays visible with no observations, including during selection.
      replace('color: "#ffb36b", transparent: true, opacity: selectedRoadId ? 0.008 : subdued ? 0.018 : 0.062, blending: THREE.AdditiveBlending, depthWrite: false',
        'color: "#a0a6b2", transparent: true, opacity: selectedRoadId ? 0.25 : subdued ? 0.2 : 0.45, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false')
      replace('color: "#bc8058", transparent: true, opacity: selectedRoadId ? 0.003 : subdued ? 0.008 : 0.018, depthWrite: false',
        'color: "#a0a6b2", transparent: true, opacity: subdued ? 0.15 : 0.3, depthTest: false, depthWrite: false, toneMapped: false')
      replace('color: "#fff1cf", transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending',
        'color: "#a0a6b2", transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending')
      const topology = 'topology && (_jsx(RoadTopology, { snapshot: topology, projection: projection, subdued: subdued, selectedRoadId: selectedRoadId }))'
      replace(topology, `${topology}, topology && _jsx(GleislichtRoadLabels, { topology, projection, subdued, selectedRoadId })`)
      return { code: 'import { RoadPolyline, roadPathOnTopology } from "/src/studies/road-geometry.ts";\nimport { GleislichtRoadLabels } from "/src/studies/GleislichtRoadLabels.tsx";\n' + code, map: null }
    },
  }
}
