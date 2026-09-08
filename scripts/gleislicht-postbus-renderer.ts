import type { Plugin } from 'vite'

/** Allow an operator's marker palette without enabling hundreds of route-identity draw calls. */
export function gleislichtPostbusRenderer(): Plugin {
  return {
    name: 'gleislicht-postbus', enforce: 'pre',
    transform(source, id) {
      if (!id.split('?')[0].replaceAll('\\', '/').endsWith('/@motionstudies/three/NationalNetworkScene.js')) return
      let code = source
      const replace = (before: string, after: string) => {
        if (code.split(before).length !== 2) throw new Error(`Gleislicht PostBus colour hook needs review: ${before}`)
        code = code.replace(before, after)
      }
      replace('const identityColor = routeColors?.[routeName];',
        'const serviceColor = routeColors?.[`category:${category}`] ?? SERVICE_COLORS[category];\n    const identityColor = routeColors?.[routeName];')
      replace('return SERVICE_COLORS[category];', 'return serviceColor;')
      replace('new THREE.Color(SERVICE_COLORS[category])', 'new THREE.Color(serviceColor)')
      replace('_jsx(SelectedTrainMarker, { train: props.selectedTrain, time: props.time, projectedStops: projectedStops, projectedPaths: projectedPaths })',
        '_jsx(SelectedTrainMarker, { train: props.selectedTrain, time: props.time, projectedStops: projectedStops, projectedPaths: projectedPaths, color: selectedTrainRouteColor })')
      replace('function SelectedStationRoutes({ station, snapshot, projectedStops, projectedPaths, selectedCategory, })',
        'function SelectedStationRoutes({ station, snapshot, projectedStops, projectedPaths, selectedCategory, routeColors, })')
      replace('_jsx(SelectedStationRoutes, {', '_jsx(SelectedStationRoutes, { routeColors: props.routeColors,')
      replace('_jsx(SelectedStationRouteLayer, { category: category,',
        '_jsx(SelectedStationRouteLayer, { color: mixedRouteColor(category, "", routeColors, 0), category: category,')
      replace('function SelectedStationRouteLayer({ category,', 'function SelectedStationRouteLayer({ color,')
      replace('    const color = SERVICE_COLORS[category];\n', '')
      return { code, map: null }
    },
  }
}
