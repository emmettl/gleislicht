import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const londonDayManifest = JSON.parse(
  await readFile(resolve('fixtures/tfl/all-change-day-manifest.json'), 'utf8'),
)
const londonBusDayManifest = JSON.parse(
  await readFile(
    resolve('fixtures/tfl/all-change-bus-day-manifest.json'),
    'utf8',
  ),
)
const newYorkDayManifest = JSON.parse(
  await readFile(resolve('fixtures/mta/local-express-day-manifest.json'), 'utf8'),
)
const parisDayManifest = JSON.parse(
  await readFile(resolve('fixtures/idfm/correspondances-day-manifest.json'), 'utf8'),
)
const parisCentralCrossDayManifest = JSON.parse(
  await readFile(
    resolve('fixtures/idfm/correspondances-central-cross-day-manifest.json'),
    'utf8',
  ),
)
const parisRegionalRerDayManifest = JSON.parse(
  await readFile(
    resolve('fixtures/idfm/correspondances-regional-rer-day-manifest.json'),
    'utf8',
  ),
)

const artifacts = [
  {
    source: 'fixtures/idfm/correspondances-morning.json',
    destination: 'public/data/correspondances-morning.json',
  },
  {
    source: 'fixtures/idfm/correspondances-central-cross-morning.json',
    destination: 'public/data/correspondances-central-cross-morning.json',
  },
  {
    source: 'fixtures/idfm/correspondances-central-cross-day-manifest.json',
    destination: 'public/data/correspondances-central-cross-day-manifest.json',
  },
  ...parisCentralCrossDayManifest.chunks.map(({ path }) => ({
    source: `fixtures/idfm/${path}`,
    destination: `public/data/${path}`,
  })),
  {
    source: 'fixtures/idfm/correspondances-regional-rer-morning.json',
    destination: 'public/data/correspondances-regional-rer-morning.json',
  },
  {
    source: 'fixtures/idfm/correspondances-regional-rer-day-manifest.json',
    destination: 'public/data/correspondances-regional-rer-day-manifest.json',
  },
  ...parisRegionalRerDayManifest.chunks.map(({ path }) => ({
    source: `fixtures/idfm/${path}`,
    destination: `public/data/${path}`,
  })),
  {
    source: 'fixtures/idfm/correspondances-geography.json',
    destination: 'public/data/correspondances-geography.json',
  },
  {
    source: 'fixtures/idfm/correspondances-day-manifest.json',
    destination: 'public/data/correspondances-day-manifest.json',
  },
  ...parisDayManifest.chunks.map(({ path }) => ({
    source: `fixtures/idfm/${path}`,
    destination: `public/data/${path}`,
  })),
  {
    source: 'fixtures/mta/local-express-lexington-morning.json',
    destination: 'public/data/local-express-lexington-morning.json',
  },
  {
    source: 'fixtures/mta/local-express-geography.json',
    destination: 'public/data/local-express-geography.json',
  },
  {
    source: 'fixtures/mta/local-express-diagram.json',
    destination: 'public/data/local-express-diagram.json',
  },
  {
    source: 'fixtures/mta/local-express-day-manifest.json',
    destination: 'public/data/local-express-day-manifest.json',
  },
  ...newYorkDayManifest.chunks.map(({ path }) => ({
    source: `fixtures/mta/${path}`,
    destination: `public/data/${path}`,
  })),
  {
    source: 'fixtures/tfl/all-change-rail-led-morning.json',
    destination: 'public/data/all-change-rail-led-morning.json',
  },
  {
    source: 'fixtures/tfl/all-change-geography.json',
    destination: 'public/data/all-change-geography.json',
  },
  {
    source: 'fixtures/tfl/all-change-diagram.json',
    destination: 'public/data/all-change-diagram.json',
  },
  {
    source: 'fixtures/tfl/all-change-day-manifest.json',
    destination: 'public/data/all-change-day-manifest.json',
  },
  {
    source: 'fixtures/tfl/all-change-surface-day.json',
    destination: 'public/data/all-change-surface-day.json',
  },
  {
    source: 'fixtures/tfl/all-change-bus-day-manifest.json',
    destination: 'public/data/all-change-bus-day-manifest.json',
  },
  ...londonBusDayManifest.chunks.map(({ path }) => ({
    source: `fixtures/tfl/${path}`,
    destination: `public/data/${path}`,
  })),
  ...londonDayManifest.chunks.map(({ path }) => ({
    source: `fixtures/tfl/${path}`,
    destination: `public/data/${path}`,
  })),
]

for (const artifact of artifacts) {
  const destination = resolve(artifact.destination)
  await mkdir(dirname(destination), { recursive: true })
  await copyFile(resolve(artifact.source), destination)
}

console.log(`Staged ${artifacts.length} edition artifacts.`)
