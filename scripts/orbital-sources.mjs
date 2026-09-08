import { readdir, readFile } from 'node:fs/promises'
import { join, basename, dirname } from 'node:path'
import { createHash } from 'node:crypto'

const family = file => basename(file).replace(/-day(?:-manifest)?\.json$/, '')
const weekday = date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error(`Invalid orbital service date: ${date}`)
  const day = new Date(`${date}T12:00:00Z`)
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) throw new Error(`Invalid orbital service date: ${date}`)
  return day.getUTCDay() > 0 && day.getUTCDay() < 6
}

/** Discover only public full-day network assets. Never follow links into local archives. */
export async function discoverOrbitalSources(root, namedSources = []) {
  const candidates = []
  async function visit(directory = '') {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      const file = directory ? `${directory}/${entry.name}` : entry.name
      if (entry.isDirectory() && file !== 'orbital') await visit(file)
      else if (entry.isFile() && /-day(?:-manifest)?\.json$/.test(entry.name)) candidates.push(file)
    }
  }
  await visit()
  candidates.sort()
  const names = new Map(namedSources.map(source => [family(source.file), source.id]))
  const groups = new Map(), excluded = []
  for (const file of candidates) {
    const bytes = await readFile(join(root, file)), network = JSON.parse(bytes)
    if (!Array.isArray(network.stops) || !Array.isArray(network.edges) || (!Array.isArray(network.trains) && !Array.isArray(network.chunks))) {
      excluded.push({ file, reason: 'not a public-transport network snapshot' }); continue
    }
    const { serviceDate: date, windowStart, windowEnd } = network.metadata ?? {}
    if (windowStart !== 0 || windowEnd !== 86400) throw new Error(`Incomplete orbital source day: ${file}`)
    if (!weekday(date)) { excluded.push({ file, date, reason: 'weekend alternative; orbital uses a composite weekday' }); continue }
    const key = family(file), id = names.get(key) ?? key
    const candidate = { id, file, date, sha256: createHash('sha256').update(bytes).digest('hex') }
    const group = groups.get(key) ?? []; group.push(candidate); groups.set(key, group)
  }
  const selected = []
  for (const group of groups.values()) {
    // Prefer the newest weekday, then its top-level release alias. Dated
    // fixtures and release aliases are alternative copies, not extra feeds.
    group.sort((a, b) => b.date.localeCompare(a.date) || a.file.split('/').length - b.file.split('/').length || a.file.localeCompare(b.file))
    selected.push(group[0])
    excluded.push(...group.slice(1).map(source => ({ ...source, reason: 'alternate copy or older weekday', selectedFile: group[0].file })))
  }
  for (const source of namedSources) {
    if (!selected.some(candidate => family(candidate.file) === family(source.file))) throw new Error(`Missing public weekday orbital source: ${source.id}`)
  }
  // Keep established precedence for journeys shared by several feeds.
  const rank = new Map(namedSources.map((source, i) => [source.id, i]))
  selected.sort((a, b) => (rank.get(a.id) ?? namedSources.length) - (rank.get(b.id) ?? namedSources.length) || a.id.localeCompare(b.id))
  return { selected, excluded, policy: 'Every public full-day transport network; newest weekday per feed, top-level alias preferred on equal dates. Local archives, non-transport datasets and weekend alternatives are excluded.' }
}

/** Bind the build to the discovered manifest and verify its complete chunk set. */
export async function readOrbitalSource(root, source) {
  const bytes = await readFile(join(root, source.file))
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new Error(`Orbital source changed during build: ${source.file}`)
  const network = JSON.parse(bytes), inputs = createHash('sha256').update(bytes), trains = new Map()
  if (network.trains) network.trains.forEach(train => trains.set(train.id, train))
  else {
    let end = 0
    for (const descriptor of network.chunks) {
      if (descriptor.windowStart !== end || !(descriptor.windowEnd > end)) throw new Error(`Orbital source chunk gap: ${source.file}`)
      if (typeof descriptor.path !== 'string' || descriptor.path.startsWith('/') || descriptor.path.split(/[\\/]/).includes('..')) throw new Error(`Invalid orbital source chunk path: ${source.file}`)
      const file = join(dirname(source.file), descriptor.path), data = await readFile(join(root, file))
      if (descriptor.bytes !== undefined && descriptor.bytes !== data.length || descriptor.sha256 !== undefined && descriptor.sha256 !== createHash('sha256').update(data).digest('hex')) throw new Error(`Orbital source chunk integrity mismatch: ${file}`)
      const chunk = JSON.parse(data)
      if (chunk.windowStart !== descriptor.windowStart || chunk.windowEnd !== descriptor.windowEnd || !Array.isArray(chunk.trains) || descriptor.tripCount !== undefined && descriptor.tripCount !== chunk.trains.length) throw new Error(`Orbital source chunk metadata mismatch: ${file}`)
      inputs.update(data)
      chunk.trains.forEach(train => trains.set(train.id, train))
      end = descriptor.windowEnd
    }
    if (end !== 86400) throw new Error(`Incomplete orbital source chunks: ${source.file}`)
  }
  if (network.tripCount !== undefined && trains.size !== network.tripCount) throw new Error(`Incomplete source: ${source.id}`)
  return { network, trains, inputSha256: inputs.digest('hex') }
}
