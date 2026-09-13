import type { Plugin } from 'vite'

/** Port allchange's airport visibility and label priority to the alpha.4 renderer.
 * Airports belong to the enabled Air layer, independent of flight observations,
 * category selection and the vehicle-label setting.
 */
export function gleislichtAirportRenderer(): Plugin {
  return {
    name: 'gleislicht-airports', enforce: 'pre',
    transform(source, id) {
      const moduleId = id.split('?')[0].replaceAll('\\', '/')
      if (moduleId.endsWith('/@motionstudies/three/AirTrafficLayer.js')) {
        const start = source.indexOf('function AirportMarker(')
        const end = source.indexOf('export function AirTrafficLayer(', start)
        const airportMap = 'visibleAirports.map((airport) => (_jsx(AirportMarker, { airport: airport, projection: projection, showLabel: airportLabelsAreVisible(labelMode), selected: airport.id === selectedAirport?.id }, airport.id)))'
        if (start < 0 || end < 0 || source.split(airportMap).length !== 2) {
          throw new Error('Gleislicht airport visibility hook needs review')
        }
        const marker = source.slice(start, end)
        const labelOrder = 'ref: label, renderOrder: 20,'
        if (marker.split(labelOrder).length !== 2) throw new Error('Gleislicht airport label priority hook needs review')
        let code = (source.slice(0, start) + marker
            .replace('function AirportMarker(', 'export function AirportMarker(')
            .replace(labelOrder, 'ref: label, name: `airport-label:${airport.id}`, renderOrder: 30, userData: { pickAirport: airport },')
            .replaceAll('depthTest: false, depthWrite: false', 'depthTest: false, depthWrite: false, fog: false')
            + source.slice(end)).replace(airportMap, 'null')
        for (const [before, after] of [
          ['ref: marker, position: position, renderOrder: 19,', 'ref: marker, position: position, renderOrder: 19, userData: { pickAirport: airport },'],
          ['const aircraftRef = useRef([]);', 'const { scene, camera, gl } = useThree();\n    const aircraftRef = useRef([]);'],
          ['onPointerDown: (event) => {\n                    if (event.instanceId === undefined)', 'onClick: (event) => {\n                    if (event.delta > 5 || pickAirportTarget(scene, camera, gl.domElement.getBoundingClientRect(), event.clientX, event.clientY, event.pointerType === "touch")) return;\n                    if (event.instanceId === undefined)'],
        ]) {
          if (code.split(before).length !== 2) throw new Error(`Gleislicht airport picking hook needs review: ${before}`)
          code = code.replace(before, after)
        }
        return {
          code: 'import { pickAirportTarget } from "/src/studies/map-selection.ts";\n' + code,
          map: null,
        }
      }
      if (!moduleId.endsWith('/@motionstudies/three/NationalNetworkScene.js')) return
      let code = source
      for (const [before, after] of [
        // Neither aircraft nor airport meshes are used until the air layer opens.
        // Keep their renderer out of the national and regional rail first view.
        ["import { AirTrafficLayer } from './AirTrafficLayer.js';", `import { lazy as lazyAir, Suspense as AirSuspense } from 'react';
const LazyAirTrafficLayer = lazyAir(() => import('./AirTrafficLayer.js').then(module => ({ default: module.AirTrafficLayer })));
const LazyAirportMarker = lazyAir(() => import('./AirTrafficLayer.js').then(module => ({ default: module.AirportMarker })));
const AirTrafficLayer = props => _jsx(AirSuspense, { fallback: null, children: _jsx(LazyAirTrafficLayer, { ...props }) });
const AirportMarker = props => _jsx(AirSuspense, { fallback: null, children: _jsx(LazyAirportMarker, { ...props }) });`],
        ['props.airSnapshot && (_jsx(AirTrafficLayer,', 'props.airports?.map((airport) => _jsx(AirportMarker, { airport, projection, showLabel: true, selected: airport.id === props.selectedAirport?.id }, airport.id)), props.airSnapshot && (_jsx(AirTrafficLayer,'],
      ]) {
        if (code.split(before).length !== 2) throw new Error(`Gleislicht airport scene hook needs review: ${before}`)
        code = code.replace(before, after)
      }
      return { code, map: null }
    },
  }
}
