import type { Plugin } from 'vite'

/** Worker transfer and fallback are edition-owned; CPU rendering is shared. */
export function gleislichtPerformanceRenderer(): Plugin {
  return { name: 'gleislicht-trail-worker', enforce: 'pre',
    transform(source, id) {
      if (!id.split('?')[0].replaceAll('\\', '/').endsWith('/@motionstudies/three/NationalNetworkScene.js')) return
      let code = source
      const replace = (before: string, after: string) => {
        if (code.split(before).length !== 2) throw new Error(`Gleislicht worker hook needs review: ${before}`)
        code = code.replace(before, after)
      }
      const from = code.indexOf('function VehicleTrails('), to = code.indexOf('function SelectedTrainMarker(', from)
      if (from < 0 || to < 0) throw new Error('Gleislicht worker component needs review')
      let trails = code.slice(from, to)
      for (const hook of [
        'if (!pausedFrame.needsUpdate(isPlaying, localTime.current, pausedVisibility)) return;',
        'pausedFrame.record(localTime.current, pausedVisibility);',
      ]) {
        // TypeScript emits single-line returns as two lines.
        const formatted = hook.replace(') return;', ')\n            return;')
        if (!trails.includes(formatted)) throw new Error('Gleislicht worker pause hook needs review')
        trails = trails.replace(formatted, '')
      }
      code = code.slice(0, from) + trails + code.slice(to)
        replace('const lastUpdate = useRef(-1);', 'const lastUpdate = useRef(-1);\n    const trailWorker = useMemo(() => new TrailWorkerClient(), []);')
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
        replace('if (!trailFrameBudget.shouldUpdateTrail(delta, clock.elapsedTime - lastUpdate.current, !isPlaying))',
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
        code = 'import { TrailWorkerClient } from "/src/studies/trail-worker-client.ts";\n' + code
      replace('const samples = sampleTimes.map((sampleTime) => projectedTrainPosition(train, sampleTime, projectedStops, projectedPaths, lakeAvoidingPaths));',
        'if (workerActive) { workerTrainIds.push(train.id); continue; }\n            const samples = sampleTimes.map((sampleTime) => projectedTrainPosition(train, sampleTime, projectedStops, projectedPaths, lakeAvoidingPaths));')
      return { code: 'import { applyTrailBuffers } from "/src/studies/active-geometry.ts";\n' + code, map: null }
    },
  }
}
