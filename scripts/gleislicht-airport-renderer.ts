import type { Plugin } from 'vite'

/** Keep the air implementation lazy and retain named objects for rendering audits.
 * Visibility, materials and pointer policy use the public scene contracts.
 */
export function gleislichtAirportRenderer(): Plugin {
  return {
    name: 'gleislicht-airports', enforce: 'pre',
    transform(source, id) {
      const moduleId = id.split('?')[0].replaceAll('\\', '/')
      if (moduleId.endsWith('/@motionstudies/three/AirTrafficLayer.js')) {
        const before = 'ref: label, renderOrder: style?.labelRenderOrder ?? 20,'
        if (source.split(before).length !== 2) throw new Error('Gleislicht airport audit name hook needs review')
        return { code: source.replace(before, 'ref: label, name: `airport-label:${airport.id}`, renderOrder: style?.labelRenderOrder ?? 20,'), map: null }
      }
      if (!moduleId.endsWith('/@motionstudies/three/NationalNetworkScene.js')) return
      const before = "import { AirTrafficLayer, AirportMarker } from './AirTrafficLayer.js';"
      if (source.split(before).length !== 2) throw new Error('Gleislicht deferred air layer hook needs review')
      return { code: source.replace(before, `import { lazy as lazyAir, Suspense as AirSuspense } from 'react';
const LazyAirTrafficLayer = lazyAir(() => import('./AirTrafficLayer.js').then(module => ({ default: module.AirTrafficLayer })));
const LazyAirportMarker = lazyAir(() => import('./AirTrafficLayer.js').then(module => ({ default: module.AirportMarker })));
const AirTrafficLayer = props => _jsx(AirSuspense, { fallback: null, children: _jsx(LazyAirTrafficLayer, { ...props }) });
const AirportMarker = props => _jsx(AirSuspense, { fallback: null, children: _jsx(LazyAirportMarker, { ...props }) });`), map: null }
    },
  }
}
