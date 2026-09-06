import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

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
]

for (const artifact of artifacts) {
  const destination = resolve(artifact.destination)
  await mkdir(dirname(destination), { recursive: true })
  await copyFile(resolve(artifact.source), destination)
}

console.log(`Staged ${artifacts.length} edition artifacts.`)
