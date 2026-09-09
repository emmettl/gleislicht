import type { Plugin } from 'vite'

/** Keep flat map layers together at street zoom; draw order supplies visual hierarchy. */
export function gleislichtSurfaceRenderer(): Plugin {
  return {
    name: 'gleislicht-surface', enforce: 'pre',
    transform(source, id) {
      const moduleId = id.split('?')[0].replaceAll('\\', '/')
      if (moduleId.endsWith('/@motionstudies/three/regional-lod.js')) {
        // Home framing can move closer without moving the visibility thresholds
        // along with it. Other studies retain the renderer's home-relative detail.
        const before = 'cameraHeight / homeMapDistanceScale(framing)'
        if (source.split(before).length !== 2) throw new Error('Gleislicht regional detail hook needs review')
        return { code: source.replace(before, 'cameraHeight / (framing.localDetailDistanceScale ?? homeMapDistanceScale(framing))'), map: null }
      }
      if (!moduleId.endsWith('/@motionstudies/three/NationalNetworkScene.js') &&
          !moduleId.endsWith('/@motionstudies/three/RoadTrafficLayer.js')) return
      let code = source
      const replace = (before: string, after: string, count = 1) => {
        if (code.split(before).length !== count + 1) throw new Error(`Gleislicht surface hook needs review: ${before}`)
        code = code.replaceAll(before, after)
      }
      if (moduleId.endsWith('/RoadTrafficLayer.js')) {
        replace('height = 0.11', 'height = MAP_SURFACE_Y')
        replace('projection, 0.065)', 'projection, MAP_SURFACE_Y)', 2)
        replace('projection, 0.085)', 'projection, MAP_SURFACE_Y)')
        replace('projection, 0.12)', 'projection, MAP_SURFACE_Y)')
      } else {
        // Land, grid and water previously sat as much as 0.11 world units
        // below the network. At city zoom that produces obvious parallax.
        replace('position: [0, -0.11, 0]', 'position: [0, -MAP_SURFACE_Y, 0]')
        replace('position: [0, 0.015, 0]', 'position: [0, 0.00002, 0]')
        replace('position: [0, -0.072, 0]', 'position: [0, 0, 0]')
        replace('position: [0, 0.007, 0]', 'position: [0, 0.00004, 0]')
        replace('position: [0, 0.014, 0]', 'position: [0, 0.00008, 0]')
        // At national zoom these nearly coplanar layers collapse to the same
        // depth values on Safari. Composite the transparent basemap in a fixed
        // order before the network, without writing depth for subsequent layers.
        // Keep depth testing so genuinely raised, opaque markers still occlude it.
        replace('rotation: [-Math.PI / 2, 0, 0], children:',
          'rotation: [-Math.PI / 2, 0, 0], renderOrder: -7, children:')
        replace('position: [0, 0.00002, 0], children:',
          'position: [0, 0.00002, 0], renderOrder: -6, children:')
        replace('color: "#090b1f", transparent: true, opacity: 0.7',
          'color: "#090b1f", transparent: true, opacity: 0.7, depthWrite: false')
        replace('color: "#424b98", transparent: true, opacity: 0.1, wireframe: true',
          'color: "#424b98", transparent: true, opacity: 0.1, wireframe: true, depthWrite: false')
        replace('geometry: geometry.fill, renderOrder: 1,',
          'geometry: geometry.fill, renderOrder: -5,')
        replace('position: [0, 0.00004, 0], renderOrder: 1,',
          'position: [0, 0.00004, 0], renderOrder: -4,')
        replace('position: [0, 0.00008, 0], renderOrder: 2,',
          'position: [0, 0.00008, 0], renderOrder: -3,')
        // The border must also precede the depth-writing rail graph: its flat
        // glow/core otherwise flicker where distant geometry shares a depth value.
        replace('geometry: glow, children:', 'geometry: glow, renderOrder: -2, children:')
        replace('geometry: core, renderOrder: 2,', 'geometry: core, renderOrder: -1,')
        replace('const STATION_SURFACE_Y = 0.005;', 'const STATION_SURFACE_Y = MAP_SURFACE_Y;')
        replace('path?.points ?? detour?.points ?? [from, to], 0);',
          'path?.points ?? detour?.points ?? [from, to], MAP_SURFACE_Y);')
        replace('position: [0, 0.055, 0]', 'position: [0, MAP_SURFACE_Y, 0]')
        replace('offsetProjectedPath(points, laneOffset), 0.075)', 'offsetProjectedPath(points, laneOffset), MAP_SURFACE_Y)')
        replace('diagramRibbonGeometry(record.positions, 0.16, 0.072)', 'diagramRibbonGeometry(record.positions, 0.16, MAP_SURFACE_Y)')
        replace('diagramRibbonGeometry(record.positions, 0.1, 0.078)', 'diagramRibbonGeometry(record.positions, 0.1, MAP_SURFACE_Y)')
        for (const lift of ['0.09', '0.1', '0.08']) {
          replace(`STATION_SURFACE_Y + ${lift},`, 'STATION_SURFACE_Y,')
        }
        replace('path.points, 0.025)', 'path.points, MAP_SURFACE_Y)')
        replace('new THREE.Vector3(x, 0.02, z)', 'new THREE.Vector3(x, MAP_SURFACE_Y, z)')
        replace('projectCoordinate(coordinate, projection)), 0.028)', 'projectCoordinate(coordinate, projection)), MAP_SURFACE_Y)')
        replace('projectCoordinate(coordinate, projection, 0.075)', 'projectCoordinate(coordinate, projection, MAP_SURFACE_Y)')
        // Wide border, water and comparison strokes use tubes. Compress only
        // their vertical thickness, retaining their horizontal stroke widths.
        for (const args of [
          'Math.max(24, path.points.length * 6), 0.085, 5, false',
          'segments, 0.13, 5, true', 'segments, 0.026, 5, true',
          'segments, coreRadius, 5, false', 'segments, glowRadius, 5, false',
        ]) {
          replace(`new THREE.TubeGeometry(curve, ${args})`,
            `new THREE.TubeGeometry(curve, ${args}).translate(0, -MAP_SURFACE_Y, 0).scale(1, 0.001, 1).translate(0, MAP_SURFACE_Y, 0)`)
        }
      }
      return { code: 'import { MAP_SURFACE_Y } from "/src/studies/map-surface.ts";\n' + code, map: null }
    },
  }
}
