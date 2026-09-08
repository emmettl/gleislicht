import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileCantonalRoadStudy } from './compile-astra-national-study.mjs'
import { swissDateAndTime } from './compile-astra-road-study.mjs'

export function buildCantonalPilot(snapshots, topology, { serviceDate, windowStart, windowEnd }) {
  if (!serviceDate || !Number.isInteger(windowStart) || !Number.isInteger(windowEnd) || windowStart % 60 || windowEnd % 60 || windowStart < 0 || windowEnd >= 86400 || windowEnd <= windowStart) throw new Error('Specify a valid pilot date and minute-aligned window')
  const horgenSites = new Set(topology.sites.filter(s => ['ZH.CH:4590', 'ZH.CH:4290'].includes(s.stationId)).map(s => s.id))
  topology = { ...topology, sections: topology.sections.filter(s => s.road === 'ZH:3' && horgenSites.has(s.fromSiteId) && horgenSites.has(s.toSiteId)) }
  if (topology.sections.length !== 2 || new Set(topology.sections.map(s => s.direction)).size !== 2) throw new Error('Horgen pilot requires both validated directions')
  const minutes = new Map()
  for (const snapshot of snapshots) {
    if (snapshot.metadata?.recordingScope !== 'zurich-cantonal' || snapshot.metadata.measurementKind !== 'recorded') continue
    const groups = new Map()
    for (const m of snapshot.measurements) {
      if (!groups.has(m.measurementTime)) groups.set(m.measurementTime, [])
      groups.get(m.measurementTime).push(m)
    }
    for (const [time, measurements] of groups) {
      const local = swissDateAndTime(time)
      if (local.date !== serviceDate || local.seconds < windowStart || local.seconds > windowEnd) continue
      const entries = minutes.get(local.seconds) ?? []
      entries.push({ ...snapshot, measurements })
      minutes.set(local.seconds, entries)
    }
  }
  const windows = [], missingMinutes = []
  let run = []
  function flush() {
    if (run.length >= 2) windows.push(compileCantonalRoadStudy(run.flatMap(time => minutes.get(time)), topology, { serviceDate, minimumSamples: 2 }))
    else missingMinutes.push(...run)
    run = []
  }
  for (let time = windowStart; time <= windowEnd; time += 60) {
    try {
      compileCantonalRoadStudy(minutes.get(time) ?? [], topology, { serviceDate, minimumSamples: 1 })
      run.push(time)
    } catch (error) {
      if (!/No sufficiently complete/.test(error.message)) throw error
      flush()
      missingMinutes.push(time)
    }
  }
  flush()
  if (!windows.length) throw new Error('No continuous pilot windows')
  const ids = new Set(windows[0].siteIds)
  const gaps = []
  for (const time of missingMinutes.sort((a,b) => a-b)) {
    const previous = gaps.at(-1)
    if (previous && previous.end + 60 === time) previous.end = time
    else gaps.push({ start: time, end: time })
  }
  return {
    metadata: { schemaVersion: 1, recordingScope: 'zurich-cantonal', publisher: 'Tiefbauamt Kanton Zürich', serviceDate, windowStart, windowEnd, measurementKind: 'recorded', road: 'ZH:3', name: 'Horgen · Seestrasse', completeMinutes: windows.reduce((n,w) => n+w.minutes.length,0), note: 'Pilot reconstruction between two counters. Missing observations are not interpolated. Turning flows at junctions are not measured.' },
    topology: { sites: topology.sites.filter(s => ids.has(s.id)), sections: topology.sections }, windows, gaps,
  }
}
async function main() {
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length+3)
  const input = arg('input') ?? 'recordings/astra-zurich-cantonal'
  const source = await readFile('data/zurich-cantonal-road-directions.json','utf8')
  const snapshots = await Promise.all((await readdir(input)).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await readFile(resolve(input,f),'utf8'))))
  const pilot = buildCantonalPilot(snapshots, JSON.parse(source), { serviceDate: '2026-09-08', windowStart: 13*3600+23*60, windowEnd: 14*3600+21*60 })
  pilot.metadata.directionTopologySha256 = createHash('sha256').update(source).digest('hex')
  await writeFile(arg('output') ?? 'public/data/zurich-cantonal-road-pilot.json', JSON.stringify(pilot)+'\n')
  console.log(JSON.stringify({ ...pilot.metadata, windows: pilot.windows.map(w=>[w.metadata.windowStart,w.metadata.windowEnd]), gaps: pilot.gaps },null,2))
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main()
