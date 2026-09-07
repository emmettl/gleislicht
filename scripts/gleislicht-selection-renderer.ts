import type { Plugin } from 'vite'

/** Adapt selection picking and marker sizing in the pinned renderer. */
export function gleislichtSelectionRenderer(): Plugin {
  return {
    name: 'gleislicht-selection', enforce: 'pre',
    transform(source, id) {
      if (!id.split('?')[0].replaceAll('\\', '/').endsWith('/@motionstudies/three/NationalNetworkScene.js')) return
      let code = source
      const replace = (before: string, after: string) => {
        if (code.split(before).length !== 2) throw new Error(`Gleislicht selection hook needs review: ${before}`)
        code = code.replace(before, after)
      }
      const start = code.indexOf('function StationTapTarget(')
      const end = code.indexOf('function StationLabels(', start)
      if (start < 0 || end < 0) throw new Error('Gleislicht selection component hook needs review')
      code = code.slice(0, start) + code.slice(end)
      replace('_jsx(StationTapTarget, { stations: props.stations, projectedStops: projectedStops, cameraFraming: props.cameraFraming, onSelectStation: props.airCategorySelected ? undefined : props.onSelectStation })',
        '_jsx(GleislichtMapSelection, { stations: props.stations, onSelectStation: props.onSelectStation, onSelectTrain: props.onSelectTrain, disabled: props.airCategorySelected || props.roadCategorySelected })')
      replace('sprite.position.copy(label.position);',
        "sprite.position.copy(label.position);\n            sprite.userData.pickTarget = { kind: 'station', value: label.station };")
      replace('sprite.position.set(candidate.position[0], 0.76 + comparisonOffset, candidate.position[2]);',
        "sprite.position.set(candidate.position[0], 0.76 + comparisonOffset, candidate.position[2]);\n            sprite.userData.pickTarget = { kind: 'train', value: candidate.train };")
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
        '_jsxs("group", { ref: selectionMarker, position: [centre.x, 0.28, centre.z], children:')
      replace('marker.current.scale.setScalar(pulse);',
        'marker.current.scale.setScalar(pulse * selectionMarkerScale(state.camera, marker.current.position, state.size.height, 0.24, 3.5));')
      return { code: 'import { GleislichtMapSelection } from "/src/studies/GleislichtMapSelection.tsx";\nimport { selectionMarkerScale } from "/src/studies/selection-marker-scale.ts";\n' + code, map: null }
    },
  }
}
