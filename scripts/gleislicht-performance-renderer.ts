import type { Plugin } from 'vite'

/** Narrow fixes for the pinned renderer until these optimizations ship upstream. */
export function gleislichtPerformanceRenderer(): Plugin {
  return {
    name: 'gleislicht-performance', enforce: 'pre',
    transform(source, id) {
      const moduleId = id.split('?')[0].replaceAll('\\', '/')
      if (!moduleId.endsWith('/@motionstudies/three/air-labels.js') &&
          !moduleId.endsWith('/@motionstudies/three/train-labels.js') &&
          !moduleId.endsWith('/@motionstudies/three/NationalNetworkScene.js') &&
          !moduleId.endsWith('/@motionstudies/three/HubPulseScene.js') &&
          !moduleId.endsWith('/@motionstudies/three/AirTrafficLayer.js')) return
      let code = source
      const replace = (before: string, after: string) => {
        if (code.split(before).length !== 2) throw new Error(`Gleislicht performance hook needs review: ${before}`)
        code = code.replace(before, after)
      }
      if (moduleId.endsWith('/air-labels.js')) {
        // localeCompare with options creates an Intl.Collator for every comparison.
        // A single numeric English collator preserves ordering for all frames.
        replace("first.callsign.localeCompare(second.callsign, 'en', { numeric: true })", 'airLabelCollator.compare(first.callsign, second.callsign)')
        replace("first.id.localeCompare(second.id, 'en', { numeric: true })", 'airLabelCollator.compare(first.id, second.id)')
        code = "const airLabelCollator = new Intl.Collator('en', { numeric: true });\n" + code
      } else if (moduleId.endsWith('/train-labels.js')) {
        replace("first.id.localeCompare(second.id, 'de-CH', { numeric: true })", 'trainLabelCollator.compare(first.id, second.id)')
        replace(`routeLabel.localeCompare(serviceLabel, undefined, {
        sensitivity: 'accent',
    })`, 'trainIdentityCollator.compare(routeLabel, serviceLabel)')
        code = "const trainLabelCollator = new Intl.Collator('de-CH', { numeric: true });\nconst trainIdentityCollator = new Intl.Collator(undefined, { sensitivity: 'accent' });\n" + code
      } else if (moduleId.endsWith('/HubPulseScene.js')) {
        replace('return group;', 'const batches = batchHubLines(group.children);\n        group.clear();\n        group.add(...batches);\n        return group;')
        replace('return calls.flatMap((call, index) => {', 'const lines = calls.flatMap((call, index) => {')
        replace('    }, [calls, selectedCategory]);',
          '        return batchHubLines(lines.map(entry => entry.line)).map((line, index) => ({ key: `batch:${index}`, line }));\n    }, [calls, selectedCategory]);')
        code = 'import { batchHubLines } from "/src/studies/batch-hub-lines.ts";\n' + code
      } else if (moduleId.endsWith('/NationalNetworkScene.js')) {
        replace("import { positionForTrain, } from '@motionstudies/core/domain/network';",
          'import { positionForTrain } from "/src/studies/train-position.ts";')
        // Buffers have capacity for the whole timetable, not just active trips.
        replace(`mutableGeometry.getAttribute('position').needsUpdate = true;
            mutableGeometry.getAttribute('color').needsUpdate = true;
            mutableGeometry.setDrawRange(0, activeCounts[kind]);`,
        'updateActiveGeometry(mutableGeometry, activeCounts[kind]);')
        replace(`realtimeGeometry.getAttribute('position').needsUpdate = true;
        realtimeGeometry.setDrawRange(0, activeRealtimeCount);`,
        'updateActiveGeometry(realtimeGeometry, activeRealtimeCount);')
        replace(`geometry.getAttribute('position').needsUpdate = true;
            geometry.getAttribute('color').needsUpdate = true;
            geometry.setDrawRange(0, segmentCounts[index] * 2);`,
        'updateActiveGeometry(geometry, segmentCounts[index] * 2);')
        // Most candidates in the coarse time bucket have no trail at this time.
        replace('const samples = sampleTimes.map((sampleTime) => projectedTrainPosition(train, sampleTime, projectedStops, projectedPaths, lakeAvoidingPaths));',
          `if (train.realtime?.status === 'cancelled' || localTime.current < train.start || sampleTimes[VEHICLE_TRAIL_SEGMENTS] > train.end) continue;
            const samples = sampleTimes.map((sampleTime) => projectedTrainPosition(train, sampleTime, projectedStops, projectedPaths, lakeAvoidingPaths));`)
        replace('colorArrays[index].set([color.r, color.g, color.b, color.r, color.g, color.b], offset);',
          `const colors = colorArrays[index];
                colors[offset] = colors[offset + 3] = color.r;
                colors[offset + 1] = colors[offset + 4] = color.g;
                colors[offset + 2] = colors[offset + 5] = color.b;`)
        code = 'import { updateActiveGeometry } from "/src/studies/active-geometry.ts";\n' + code
      } else {
        // useRef's argument is evaluated on every React render, even after mount.
        // The frame callback supplies aircraftRef for labels and picking.
        replace('const aircraftRef = useRef(currentAircraft(snapshot, time, projection));', 'const aircraftRef = useRef([]);')
        replace('const bodyRef = useRef(null);', 'const bodyRef = useRef(null);\n    const aircraftTransform = useMemo(() => new THREE.Object3D(), []);')
        replace('const transform = new THREE.Object3D();', 'const transform = aircraftTransform;')
        // Raycasting still uses this material/geometry, but the invisible hit
        // spheres need no GPU draw or per-frame instance uploads.
        replace('ref: hitRef, args:', 'ref: hitRef, name: "aircraft-hit-targets", args:')
        replace('transparent: true, opacity: 0, depthWrite: false', 'visible: false, transparent: true, opacity: 0, depthWrite: false')
        replace('mesh.instanceMatrix.needsUpdate = true;', 'if (mesh !== hit) mesh.instanceMatrix.needsUpdate = true;')
      }
      return { code, map: null }
    },
  }
}
