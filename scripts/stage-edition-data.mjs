import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const londonDayManifest = JSON.parse(
  await readFile(resolve('fixtures/tfl/all-change-day-manifest.json'), 'utf8'),
)

const artifacts = [
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
