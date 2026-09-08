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
        // Limit full label searches, retaining per-frame movement and overlap
        // checks for the labels that were actually displayed last frame.
        const replaceIn = (start: string, end: string, before: string, after: string) => {
          const first = code.indexOf(start), last = code.indexOf(end, first);
          if (first < 0 || last < 0) throw new Error('Gleislicht component hook needs review');
          const section = code.slice(first, last);
          if (section.split(before).length !== 2) throw new Error(`Gleislicht component hook needs review: ${before}`);
          code = code.slice(0, first) + section.replace(before, after) + code.slice(last);
        };
        const labelReplace = (before: string, after: string) => replaceIn('function TrainLabels(', 'function SelectedStationRouteLayer(', before, after);
        labelReplace('    useFrame((_, delta) => {', `    const labelFrameBudget = useMemo(() => new LabelFrameBudget(), []);
    const visibleLabelTrains = useRef([]);
    const labelInputs = useMemo(() => ({}), [snapshot, projectedStops, projectedPaths,
      selectedTrain, comparisonTrains, selectedRoute, selectedStation, selectedCategory,
      airCategorySelected, roadCategorySelected, trainLabelMode, isPlaying, playbackRate,
      trainTimeIndex, cameraFraming, layoutTransitioning, routeColors, routeColorMix, lakeAvoidingPaths]);
    useFrame((_, delta) => {`);
        labelReplace('        sprites.current.forEach((sprite) => {', `        const labelWork = labelFrameBudget.update(labelInputs, camera, size.width, size.height,
          localTime.current, delta, isPlaying, playbackRate);
        if (labelWork === 'idle') return;
        const labelTrains = labelWork === 'all' ? trainsNearTime(trainTimeIndex, localTime.current) : visibleLabelTrains.current;
        visibleLabelTrains.current = [];
        sprites.current.forEach((sprite) => {`);
        labelReplace('for (const train of trainsNearTime(trainTimeIndex, localTime.current)) {', 'for (const train of labelTrains) {');
        labelReplace('            sprite.visible = true;', '            visibleLabelTrains.current.push(candidate.train);\n            sprite.visible = true;');
        // Paused marker buffers depend on data, selection and zoom, not on frames.
        const swarmReplace = (before: string, after: string) => replaceIn('function TrainSwarm(', 'function VehicleTrails(', before, after);
        swarmReplace('    useFrame((state, delta) => {', `    const markerInputs = useMemo(() => ({}), [snapshot, projectedStops, projectedPaths,
      selectedTrain, comparisonTrains, selectedRoute, selectedCategory, airCategorySelected,
      selectedStation, trainTimeIndex, cameraFraming, trainPalette, palette, geometries,
      realtimeGeometry, lakeAvoidingPaths, isPlaying, time]);
    const previousMarkers = useRef({ inputs: undefined, cameraHeight: NaN, time: NaN });
    useFrame((state, delta) => {
        if (!isPlaying && previousMarkers.current.inputs === markerInputs &&
            previousMarkers.current.cameraHeight === state.camera.position.y &&
            previousMarkers.current.time === localTime.current) return;
        previousMarkers.current.inputs = markerInputs;
        previousMarkers.current.cameraHeight = state.camera.position.y;
        previousMarkers.current.time = localTime.current;`);
        code = 'import { LabelFrameBudget } from "/src/studies/label-frame-budget.ts";\n' + code;

        // Overview clock reports reconcile both the app and the R3F tree. Under
        // load, report at 5 Hz instead of 10 Hz; markers still advance each frame.
        // Focused markers consume the React clock, so preserve their cadence.
        replace('const lastReport = useRef(0);', 'const lastReport = useRef(0);\n    const uiFrameBudget = useMemo(() => new TrailFrameBudget(), []);')
        replace('state.clock.elapsedTime - lastReport.current > 0.1',
          'state.clock.elapsedTime - lastReport.current > (selectedTrain || comparisonTrains?.length ? 0.1 : uiFrameBudget.interval(delta) * 3)')
        replace('const lastUpdate = useRef(-1);', 'const lastUpdate = useRef(-1);\n    const trailFrameBudget = useMemo(() => new TrailFrameBudget(), []);\n    const trailWorker = useMemo(() => new TrailWorkerClient(), []);')
        replace('    }), [snapshot.trains.length]);', `    }), [snapshot.trains.length]);
    const trailSelection = useMemo(() => ({}), [selectedTrain, comparisonTrains, selectedRoute,
      selectedCategory, airCategorySelected, selectedStation, cameraFraming, isPlaying, isPlaying ? undefined : time,
      snapshot, projectedStops, projectedPaths, lakeAvoidingPaths, trainPalette, palette, trainTimeIndex]);
    const previousPausedTrail = useRef({ inputs: undefined, visibility: '', worker: false, time: NaN });
    useEffect(() => {
      if (!snapshot.trains.length) { trailWorker.dispose(); return; }
      trailWorker.reset(() => ({ trains: snapshot.trains, stops: projectedStops, paths: projectedPaths,
        detours: [...lakeAvoidingPaths], colors: snapshot.trains.map(train => {
          const color = trainPalette.get(train.id) ?? palette[train.category] ?? palette.other;
          return [color.r, color.g, color.b];
        }) }));
      return () => trailWorker.dispose();
    }, [trailWorker, snapshot.trains, projectedStops, projectedPaths, lakeAvoidingPaths, trainPalette, palette]);`)
        replace('if (clock.elapsedTime - lastUpdate.current < 1 / 30)',
          `const trailVisibility = String(vehicleIsVisibleAtZoom('bus', camera.position.y, cameraFraming)) + String(vehicleIsVisibleAtZoom('tram', camera.position.y, cameraFraming));
        trailWorker.select(trailSelection, trailVisibility);
        const completedTrailFrame = trailWorker.takeFrame();
        if (completedTrailFrame) {
          applyTrailBuffers(geometries, completedTrailFrame);
          if (!trailWorker.available) previousPausedTrail.current.inputs = undefined;
        }
        if (!isPlaying && previousPausedTrail.current.inputs === trailSelection &&
            previousPausedTrail.current.visibility === trailVisibility &&
            previousPausedTrail.current.worker === trailWorker.available &&
            previousPausedTrail.current.time === localTime.current) return;
        if (!trailFrameBudget.shouldUpdateTrail(delta, clock.elapsedTime - lastUpdate.current))`)
        replace('lastUpdate.current = clock.elapsedTime;',
          'lastUpdate.current = clock.elapsedTime;\n        previousPausedTrail.current = { inputs: trailSelection, visibility: trailVisibility, worker: trailWorker.available, time: localTime.current };')
        replace('const sampleTimes = vehicleTrailSampleTimes(localTime.current);',
          'const workerActive = trailWorker.available;\n        const workerTrainIds = [];\n        const sampleTimes = vehicleTrailSampleTimes(localTime.current);')
        replace('        geometries.forEach((geometry, index) => {',
          '        if (workerActive) { trailWorker.submit(localTime.current, workerTrainIds); return; }\n        geometries.forEach((geometry, index) => {')
        code = 'import { TrailWorkerClient } from "/src/studies/trail-worker-client.ts";\nimport { TrailFrameBudget } from "/src/studies/trail-frame-budget.ts";\n' + code
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
            if (workerActive) { workerTrainIds.push(train.id); continue; }
            const samples = sampleTimes.map((sampleTime) => projectedTrainPosition(train, sampleTime, projectedStops, projectedPaths, lakeAvoidingPaths));`)
        replace('colorArrays[index].set([color.r, color.g, color.b, color.r, color.g, color.b], offset);',
          `const colors = colorArrays[index];
                colors[offset] = colors[offset + 3] = color.r;
                colors[offset + 1] = colors[offset + 4] = color.g;
                colors[offset + 2] = colors[offset + 5] = color.b;`)
        code = 'import { updateActiveGeometry, applyTrailBuffers } from "/src/studies/active-geometry.ts";\n' + code
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
