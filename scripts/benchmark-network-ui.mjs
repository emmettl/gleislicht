import { readFile } from 'node:fs/promises'
import { createActiveTrainCounter, orderTrainSearchMatches, trainSearchResults } from '../src/studies/network-ui-index.ts'

// Isolate clock-driven calculation costs; these are not page FPS measurements.
for (const [study, file] of [['SBB', 'swiss-rail-morning.json'], ['PostBus', 'postbus-national-day-chunks/06-09.json']]) {
  const { trains } = JSON.parse(await readFile(`public/data/${file}`, 'utf8'))
  const documents = trains.map(train => ({ train, text: `${train.id} ${train.route}`.toLowerCase() }))
  const query = '1'
  const start = performance.now()
  const count = createActiveTrainCounter(trains)
  const ordered = orderTrainSearchMatches(documents.filter(document => document.text.includes(query)).map(document => document.train), 'de-CH')
  const preparationMs = performance.now() - start
  const oldCount = time => trains.reduce((sum, train) => train.realtime?.status !== 'cancelled' && train.start <= time && train.end >= time ? sum + 1 : sum, 0)
  const oldSearch = time => documents.filter(document => document.text.includes(query)).map(document => document.train).sort((a, b) =>
    Number(!(a.start <= time && a.end >= time)) - Number(!(b.start <= time && b.end >= time)) ||
    a.start - b.start || a.route.localeCompare(b.route, 'de-CH')).slice(0, 8)
  const measure = calculate => {
    for (let i = 0; i < 100; i++) calculate(24300 + i * 10)
    let checksum = 0
    const start = performance.now()
    for (let i = 0; i < 1000; i++) checksum += calculate(21600 + i * 10)
    return { ms: performance.now() - start, checksum }
  }
  console.log(JSON.stringify({ study, trips: trains.length, query, matches: ordered.length, preparationMs, iterations: 1000,
    countBefore: measure(oldCount), countAfter: measure(count),
    searchBefore: measure(time => oldSearch(time).length), searchAfter: measure(time => trainSearchResults(ordered, time).length) }))
}
