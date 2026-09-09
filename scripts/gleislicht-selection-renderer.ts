import type { Plugin } from 'vite'

/** Adapt selection picking, marker sizing and surface anchoring in the pinned renderer. */
export function gleislichtSelectionRenderer(): Plugin {
  return {
    name: 'gleislicht-selection', enforce: 'pre',
    transform(source, id) {
      if (!id.split('?')[0].replaceAll('\\', '/').endsWith('/@motionstudies/three/NationalNetworkScene.js')) return
      let code = source
      const replace = (before: string, after: string, count = 1) => {
        if (code.split(before).length !== count + 1) throw new Error(`Gleislicht selection hook needs review: ${before}`)
        code = code.replaceAll(before, after)
      }
      const start = code.indexOf('function StationTapTarget(')
      const end = code.indexOf('function StationLabels(', start)
      if (start < 0 || end < 0) throw new Error('Gleislicht selection component hook needs review')
      code = code.slice(0, start) + code.slice(end)
      replace('_jsx(StationTapTarget, { stations: props.stations, projectedStops: projectedStops, cameraFraming: props.cameraFraming, onSelectStation: props.airCategorySelected ? undefined : props.onSelectStation })',
        '_jsx(GleislichtMapSelection, { stations: props.stations, onSelectStation: props.onSelectStation, onSelectTrain: props.onSelectTrain, onSelectRoad: props.onSelectRoad, onSelectAirport: props.onSelectAirport, roadsOnly: props.roadCategorySelected, disabled: props.airCategorySelected })')
      replace('sprite.position.copy(label.position);',
        "sprite.position.copy(label.position);\n            sprite.userData.pickTarget = { kind: 'station', value: label.station };")
      replace('sprite.position.set(candidate.position[0], 0.76 + comparisonOffset, candidate.position[2]);',
        "sprite.position.set(...candidate.position);\n            sprite.center.set(0.5, 0.5 + labelOffset / screenHeight);\n            sprite.userData.pickTarget = { kind: 'train', value: candidate.train };")
      // World-space lift becomes hundreds of pixels in city views. Keep map
      // overlays on one surface; renderOrder already provides their layering.
      replace('const STATION_SURFACE_Y = 0.035;', 'const STATION_SURFACE_Y = 0.005;')
      replace('return [point[0], 0.2, point[2]];', 'return [point[0], STATION_SURFACE_Y, point[2]];', 2)
      replace('        0.2,\n        THREE.MathUtils.lerp(from[2]',
        '        STATION_SURFACE_Y,\n        THREE.MathUtils.lerp(from[2]')
      replace('projected.set(position[0], 0.76, position[2]);', 'projected.set(...position);')
      replace('new THREE.Vector3(centre.x, 0.29, centre.z)', 'new THREE.Vector3(centre.x, STATION_SURFACE_Y, centre.z)')
      replace('[centre.x, 0.3, centre.z]', '[centre.x, STATION_SURFACE_Y, centre.z]')
      replace('new THREE.Vector3(x, 0.12, z)', 'new THREE.Vector3(x, STATION_SURFACE_Y, z)')
      replace('appendLineSegments(positions, points, 0.14);', 'appendLineSegments(positions, points, STATION_SURFACE_Y);')
      replace('appendLineSegments(pathPositions, points, 0.15);', 'appendLineSegments(pathPositions, points, STATION_SURFACE_Y);')
      replace('[stop[0], 0.2, stop[2]]', '[stop[0], STATION_SURFACE_Y, stop[2]]')
      replace('[stop[0], 0.19, stop[2]]', '[stop[0], STATION_SURFACE_Y, stop[2]]')
      replace('position: [0, -0.035, 0]', 'position: [0, 0, 0]')
      // Anchor badges to their vehicles with a four-pixel gap. Use the same
      // screen offset for collision boxes, including stacked comparison labels.
      replace('const width = trainLabelScreenWidth(text, screenHeight);',
        `const width = trainLabelScreenWidth(text, screenHeight);
            const labelOffset = screenHeight / 2 + 4 + Math.max(0, candidate.comparisonIndex) * (screenHeight + 4);`)
      replace('top: candidate.y - screenHeight / 2,\n                bottom: candidate.y + screenHeight / 2,',
        'top: candidate.y - labelOffset - screenHeight / 2,\n                bottom: candidate.y - labelOffset + screenHeight / 2,')
      replace(`            const comparisonOffset = candidate.comparisonIndex < 0
                ? 0
                : candidate.comparisonIndex === 0
                    ? -0.22
                    : 0.22;\n`, '')
      replace('const offset = activeCounts[markerKind] * 3;',
        'const offset = activeCounts[markerKind] * 3;\n            (mutableGeometry.userData.pickTrains ??= [])[activeCounts[markerKind]] = train;')
      replace('mutableColors[offset] = color.r * intensity;',
        'if (intensity < 0.1) mutableGeometry.userData.pickTrains[activeCounts[markerKind]] = undefined;\n            mutableColors[offset] = color.r * intensity;')
      // Regional studies render a separate national context graph. Its stop
      // indexes belong to another snapshot and must not select regional stops.
      replace('function RailGraph({ snapshot,', 'function RailGraph({ snapshot, pickable = true,')
      replace('_jsx(RailGraph, { snapshot: props.contextSnapshot,', '_jsx(RailGraph, { snapshot: props.contextSnapshot, pickable: false,')
      replace("geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));\n        return geometry;\n    }, [projectedStops]);",
        "geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));\n        geometry.userData.pickStops = pickable ? projectedStops.map((_, index) => index) : undefined;\n        return geometry;\n    }, [projectedStops, pickable]);")
      // Fixed world-size meshes overwhelm GE/ZH. Preserve overview sizes, but
      // cap the station ring at 10px and the pulsing train core at ~4px radius.
      replace('function SelectedStationRoutes({ station, snapshot, projectedStops, projectedPaths, selectedCategory, }) {',
        `function SelectedStationRoutes({ station, snapshot, projectedStops, projectedPaths, selectedCategory, }) {
    const selectionMarker = useRef(null);
    useFrame(({ camera, size }) => {
        if (selectionMarker.current)
            selectionMarker.current.scale.setScalar(selectionMarkerScale(camera, selectionMarker.current.position, size.height, 0.535, 10));
    });`)
      replace('_jsxs("group", { position: [centre.x, 0.28, centre.z], children:',
        '_jsxs("group", { ref: selectionMarker, position: [centre.x, STATION_SURFACE_Y, centre.z], children:')
      replace('marker.current.scale.setScalar(pulse);',
        'marker.current.scale.setScalar(pulse * selectionMarkerScale(state.camera, marker.current.position, state.size.height, 0.24, 3.5));')
      return { code: 'import { GleislichtMapSelection } from "/src/studies/GleislichtMapSelection.tsx";\nimport { selectionMarkerScale } from "/src/studies/selection-marker-scale.ts";\n' + code, map: null }
    },
  }
}
