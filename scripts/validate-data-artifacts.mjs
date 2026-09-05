import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const DATA_DIRECTORY = resolve('public/data')

async function readJson(path) {
  return JSON.parse(await readFile(resolve(DATA_DIRECTORY, path), 'utf8'))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const morning = await readJson('swiss-rail-morning.json')
const hubs = await readJson('swiss-hub-day.json')
const day = await readJson('swiss-rail-day-manifest.json')
const kientalCorridor = await readJson('kiental-griesalp-corridor.json')
const zurichChurCorridor = await readJson('zurich-chur-corridor.json')
const air = await readJson('swiss-air-morning.json')
const airDay = await readJson('swiss-air-day-manifest.json')

const artifacts = [morning, hubs, day]
const serviceDates = new Set(artifacts.map((artifact) => artifact.metadata?.serviceDate))
const feedVersions = new Set(artifacts.map((artifact) => artifact.metadata?.feedVersion))

assert(serviceDates.size === 1 && !serviceDates.has(undefined), 'National artifacts disagree on service date')
assert(feedVersions.size === 1 && !feedVersions.has(undefined), 'National artifacts disagree on feed version')
assert(Array.isArray(morning.trains) && morning.trains.length > 1_000, 'Morning study has too few trains')
assert(Array.isArray(morning.stops) && morning.stops.length > 500, 'Morning study has too few stops')
assert(Array.isArray(morning.edges) && morning.edges.length > 500, 'Morning study has too few edges')
assert(day.tripCount > 10_000, 'Full-day study has too few trips')
assert(Array.isArray(day.chunks) && day.chunks.length >= 8, 'Full-day study is missing time chunks')

for (const [name, artifact] of [['morning', morning], ['full-day', day]]) {
  const geometry = artifact.metadata?.geometry
  assert(Array.isArray(artifact.paths) && artifact.paths.length > 1_000, `${name} study has too few rail paths`)
  assert(Array.isArray(artifact.edgePaths), `${name} study has no edge-path index`)
  assert(geometry?.publisher === 'Federal Office of Transport (FOT)', `${name} study has no FOT geometry provenance`)
  assert(
    geometry.matchedSegments / geometry.totalSegments >= 0.65,
    `${name} study has insufficient rail geometry coverage`,
  )
  for (const destination of ['Bern', 'Basel SBB']) {
    const corridorEdges = artifact.edges
      .map((edge, edgeIndex) => ({ edge, edgeIndex }))
      .filter(({ edge: [fromIndex, toIndex] }) => {
        const names = [artifact.stops[fromIndex][2], artifact.stops[toIndex][2]]
        return names.includes('Zürich HB') && names.includes(destination)
      })
    assert(corridorEdges.length > 0, `${name} study is missing Zürich HB–${destination}`)
    assert(
      corridorEdges.every(({ edgeIndex }) => artifact.edgePaths[edgeIndex] !== null),
      `${name} study has straight Zürich HB–${destination} topology chords`,
    )
  }
}

for (const hub of ['zurich', 'bern', 'basel', 'geneva']) {
  assert(Array.isArray(hubs.hubs?.[hub]), `Hub study is missing ${hub}`)
  assert(hubs.hubs[hub].length > 100, `Hub study has too few ${hub} calls`)
}

for (const descriptor of day.chunks) {
  const chunk = await readJson(descriptor.path)
  assert(chunk.windowStart === descriptor.windowStart, `${descriptor.id} start time differs from its manifest`)
  assert(chunk.windowEnd === descriptor.windowEnd, `${descriptor.id} end time differs from its manifest`)
  assert(Array.isArray(chunk.trains), `${descriptor.id} has no train array`)
  assert(chunk.trains.length === descriptor.tripCount, `${descriptor.id} trip count differs from its manifest`)
}

assert(kientalCorridor.id === 'kiental-griesalp', 'Kiental terrain corridor has the wrong id')
assert(kientalCorridor.metadata?.source === 'swissALTI3D', 'Kiental terrain corridor is not sourced from swissALTI3D')
assert(kientalCorridor.terrain?.elevations?.length > 90_000, 'Kiental terrain grid is too coarse')
assert(kientalCorridor.route?.points?.length > 100, 'Kiental road geometry is too coarse')
assert(kientalCorridor.route?.stops?.length === 19, 'Kiental corridor does not contain the complete route 220 run')
assert(kientalCorridor.route?.distanceMetres > 13_000, 'Kiental corridor road distance is implausibly short')
assert(zurichChurCorridor.route?.tunnels?.length >= 7, 'Zürich–Chur corridor has too few matched tunnels')
assert(
  zurichChurCorridor.route.tunnels.some((tunnel) => tunnel.name === 'Zimmerberg Basistunnel'),
  'Zürich–Chur corridor is missing the Zimmerberg Basistunnel',
)
assert(
  zurichChurCorridor.route.tunnels.some((tunnel) => tunnel.name === 'Kerenzerbergtunnel'),
  'Zürich–Chur corridor is missing the Kerenzerbergtunnel',
)
assert(air.metadata?.publisher === 'ADSB.lol', 'Air study has no ADSB.lol provenance')
assert(air.metadata?.license === 'ODbL 1.0', 'Air study has the wrong data licence')
assert(air.metadata?.serviceDate === [...serviceDates][0], 'Air study does not match the railway service day')
assert(air.metadata?.sampleIntervalSeconds === 10, 'Air study has an unexpected sample cadence')
assert(air.metadata?.windowStart === 24_300, 'Air study does not start at 06:45 CEST')
assert(air.metadata?.windowEnd === 31_500, 'Air study does not end at 08:45 CEST')
assert(Array.isArray(air.tracks) && air.tracks.length > 600, 'Air study has too few aircraft tracks')
assert(
  air.tracks.every((track) =>
    track.start >= air.metadata.windowStart &&
    track.end <= air.metadata.windowEnd
  ),
  'Air study contains samples outside the national morning window',
)
assert(
  air.tracks.every((track) =>
    typeof track.id === 'string' &&
    typeof track.callsign === 'string' &&
    track.samples.length >= 4 &&
    track.samples.every((sample) => sample.length === 5),
  ),
  'Air study contains malformed tracks',
)
assert(airDay.metadata?.publisher === 'ADSB.lol', 'Air day has no ADSB.lol provenance')
assert(airDay.metadata?.license === 'ODbL 1.0', 'Air day has the wrong data licence')
assert(airDay.metadata?.serviceDate === [...serviceDates][0], 'Air day does not match the railway service day')
assert(airDay.metadata?.windowStart === 0, 'Air day does not start at midnight')
assert(airDay.metadata?.windowEnd === 86_400, 'Air day does not end at 24:00')
assert(airDay.trackCount > 3_000, 'Air day has too few indexed aircraft')
assert(airDay.sampleCount > 500_000, 'Air day has too few position samples')
assert(Array.isArray(airDay.aircraft) && airDay.aircraft.length === airDay.trackCount, 'Air day index count differs from its manifest')
assert(new Set(airDay.aircraft.map((track) => track.id)).size === airDay.trackCount, 'Air day segment ids are not unique')
assert(
  airDay.aircraft.every((track) =>
    /^[0-9a-f]{6}$/.test(track.icaoAddress) &&
    typeof track.callsign === 'string' &&
    track.start <= track.end &&
    track.chunkIds.length > 0
  ),
  'Air day contains malformed flight-segment index entries',
)
assert(Array.isArray(airDay.chunks) && airDay.chunks.length === 24, 'Air day is missing hourly chunks')

for (const [index, descriptor] of airDay.chunks.entries()) {
  const chunk = await readJson(descriptor.path)
  assert(descriptor.windowStart === index * 3_600, `${descriptor.id} has the wrong start time`)
  assert(descriptor.windowEnd === (index + 1) * 3_600, `${descriptor.id} has the wrong end time`)
  assert(chunk.windowStart === descriptor.windowStart, `${descriptor.id} start time differs from its manifest`)
  assert(chunk.windowEnd === descriptor.windowEnd, `${descriptor.id} end time differs from its manifest`)
  assert(chunk.tracks.length === descriptor.trackCount, `${descriptor.id} track count differs from its manifest`)
  assert(
    chunk.tracks.reduce((sum, track) => sum + track.samples.length, 0) === descriptor.sampleCount,
    `${descriptor.id} sample count differs from its manifest`,
  )
  assert(
    chunk.tracks.every((track) =>
      track.samples.length >= 2 &&
      track.samples.every((sample) =>
        sample[0] >= descriptor.windowStart - 180 &&
        sample[0] <= descriptor.windowEnd + 45
      )
    ),
    `${descriptor.id} has malformed tracks or invalid continuity overlap`,
  )
}

console.log(
  `Validated national GTFS ${[...feedVersions][0]} for ${[...serviceDates][0]}: ` +
    `${morning.trains.length.toLocaleString('en')} morning trips, ` +
    `${day.tripCount.toLocaleString('en')} day trips, ${day.chunks.length} chunks and ` +
    `${air.tracks.length.toLocaleString('en')} morning aircraft and ` +
    `${airDay.trackCount.toLocaleString('en')} day aircraft.`,
)
