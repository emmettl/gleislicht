import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const argument = name => process.argv[process.argv.indexOf(`--${name}`) + 1]
const required = name => {
  if (!process.argv.includes(`--${name}`)) throw new Error(`--${name} is required`)
  return resolve(argument(name))
}
async function sha256(path) {
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest('hex')
}

if (process.argv.includes('--help')) {
  console.log('Match an already prepared feed offline: --pfaedle BINARY --osm EXTRACT --config CFG --feed DIRECTORY --output DIRECTORY')
} else {
  const binary = required('pfaedle')
  const osm = required('osm')
  const config = required('config')
  const feed = required('feed')
  const output = required('output')
  await mkdir(output, { recursive: true })
  // No trie aggregation: every pattern must have its own explicit fallback
  // warnings. Otherwise pfaedle logs only one representative of a failed group.
  const args = ['-x', osm, '-c', config, '-i', feed, '-o', output, '-m', 'bus', '--no-trie', '-W', '--stats', '-d', output]
  const log = createWriteStream(resolve(output, 'matching.log'))
  const started = performance.now()
  const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.pipe(log, { end: false })
  child.stderr.pipe(log, { end: false })
  await new Promise((accept, reject) => {
    child.once('error', reject)
    child.once('close', code => log.end(() => code === 0 ? accept() : reject(new Error(`pfaedle exited ${code}; see ${output}/matching.log`))))
  })
  const provenance = {
    schemaVersion: 1, completed: true, noTrie: true, warnings: true,
    matcherVersion: execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim(),
    binarySha256: await sha256(binary), configSha256: await sha256(config),
    osmSha256: await sha256(osm), patternsSha256: await sha256(resolve(feed, 'patterns.json')),
    logSha256: await sha256(resolve(output, 'matching.log')),
    shapesSha256: await sha256(resolve(output, 'shapes.txt')),
    tripsSha256: await sha256(resolve(output, 'trips.txt')),
    stopTimesSha256: await sha256(resolve(output, 'stop_times.txt')),
    elapsedSeconds: Math.round((performance.now() - started) / 1000),
  }
  await writeFile(resolve(output, 'patterns.json'), await readFile(resolve(feed, 'patterns.json')))
  await writeFile(resolve(output, 'routing-run.json'), JSON.stringify(provenance, null, 2))
  console.log(provenance)
}
