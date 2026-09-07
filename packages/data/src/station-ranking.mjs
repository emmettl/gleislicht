

export function rankNetworkStations(snapshot, { catalogue } = {}) {
  const records = new Map()
  const nameByStopIndex = snapshot.stops.map((stop, stopIndex) => {
    const name = stop[2]
    const record = records.get(name) ?? {
      name,
      stopIndexes: [],
      trainIds: new Set(),
      routes: new Set(),
      modes: new Set(),
      neighbours: new Set(),
    }
    record.stopIndexes.push(stopIndex)
    records.set(name, record)
    return name
  })

  for (const train of snapshot.trains) {
    const visited = new Set()
    for (const [stopIndex] of train.stops) {
      const name = nameByStopIndex[stopIndex]
      if (!name || visited.has(name)) continue
      visited.add(name)
      const record = records.get(name)
      record.trainIds.add(train.id)
      record.routes.add(`${train.mode ?? train.category}:${train.route}`)
      record.modes.add(train.mode ?? train.category)
    }
  }

  if (catalogue) {
    const nameBySourceId = new Map(snapshot.stops.map((stop) => [stop[4], stop[2]]))
    for (const line of catalogue.lines ?? []) {
      const visitedNames = new Set()
      for (const branch of line.directions?.flatMap(({ branches }) => branches) ?? []) {
        for (const sourceId of branch.stopIds ?? []) {
          const name = nameBySourceId.get(sourceId)
          if (!name || visitedNames.has(name)) continue
          visitedNames.add(name)
          const record = records.get(name)
          record.routes.add(`${line.mode}:${line.name}`)
          record.modes.add(line.mode)
        }
      }
    }
  }

  for (const [fromIndex, toIndex] of snapshot.edges) {
    const from = nameByStopIndex[fromIndex]
    const to = nameByStopIndex[toIndex]
    if (!from || !to || from === to) continue
    records.get(from).neighbours.add(to)
    records.get(to).neighbours.add(from)
  }

  const scored = [...records.values()].map((record) => ({
    ...record,
    score:
      record.modes.size * 40 +
      record.routes.size * 12 +
      Math.log2(record.trainIds.size + 1) * 3 +
      Math.min(record.neighbours.size, 10),
  }))
  return scored
    .sort((first, second) =>
      second.score - first.score ||
      second.modes.size - first.modes.size ||
      second.routes.size - first.routes.size ||
      second.trainIds.size - first.trainIds.size ||
      second.neighbours.size - first.neighbours.size ||
      first.name.localeCompare(second.name, 'en-GB'))
    .map((record, labelRank) => ({
      name: record.name,
      labelRank,
      modeCount: record.modes.size,
      routeCount: record.routes.size,
      movementCount: record.trainIds.size,
      neighbourCount: record.neighbours.size,
      score: Number(record.score.toFixed(3)),
    }))
}

export function applyStationLabelRanks(snapshot, options) {
  const ranking = rankNetworkStations(snapshot, options)
  const rankByName = new Map(ranking.map(({ name, labelRank }) => [name, labelRank]))
  return {
    ...snapshot,
    metadata: {
      ...snapshot.metadata,
      labelHierarchy: {
        model: `Stable station-name rank by mode interchange, distinct routes, scheduled calls and graph degree${options?.catalogue ? ', enriched by advertised topology' : ''}`,
        stationCount: ranking.length,
      },
    },
    stops: snapshot.stops.map((stop) => [
      stop[0], stop[1], stop[2], stop[3], stop[4], rankByName.get(stop[2]),
    ]),
  }
}
