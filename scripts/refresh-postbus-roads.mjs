import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { auditPostbus } from './audit-postbus.mjs'
import { applyRoadCache, DEFAULT_ROAD_CACHE, enrichPostbusRoads } from './enrich-postbus-roads.mjs'
import { DEFAULT_MANIFEST, prepareRoadFeed, readPostbusDay } from './prepare-postbus-road-feed.mjs'

function run(command, args, timeout = 30 * 60_000) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', detached: true })
    // Kill the complete native build/download process group on timeout.
    const kill = () => {
      try { if (child.pid) process.kill(-child.pid, 'SIGKILL') }
      catch (error) { if (error.code !== 'ESRCH') throw error }
    }
    const timer = setTimeout(kill, timeout)
    process.once('SIGINT', kill)
    process.once('SIGTERM', kill)
    const cleanup = () => {
      clearTimeout(timer)
      process.removeListener('SIGINT', kill)
      process.removeListener('SIGTERM', kill)
    }
    child.once('error', error => { cleanup(); reject(error) })
    child.once('close', (code, signal) => {
      cleanup()
      if (code === 0) accept()
      else reject(new Error(`${command} failed (${signal ?? code})`))
    })
  })
}

export async function buildRoadCache(day, directory) {
  await prepareRoadFeed({ ...day, output: join(directory, 'feed') })
  await run('bash', [fileURLToPath(new URL('./build-postbus-road-cache.sh', import.meta.url)), directory])
  const cache = JSON.parse(await readFile(join(directory, 'candidate-cache.json'), 'utf8'))
  cache.metadata.roadSources = (await readFile(join(directory, 'sources.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line))
  return cache
}

/** Rebuild only when exact cached patterns no longer satisfy the existing floor.
 * Every candidate, including an Actions cache hit, must pass the production audit.
 * Never publish a partial result or automatically commit generated geometry.
 */
export async function refreshPostbusRoads({
  snapshotPath = DEFAULT_MANIFEST,
  cachePath = DEFAULT_ROAD_CACHE,
  reusableCachePath,
  workDirectory,
  build = buildRoadCache,
  audit = auditPostbus,
}) {
  assert(workDirectory, 'A temporary --work-directory is required')
  await mkdir(workDirectory, { recursive: true })
  const directory = await mkdtemp(join(resolve(workDirectory), 'refresh-'))
  try {
    const day = await readPostbusDay(snapshotPath)
    const staging = join(directory, 'staged')
    const stagedManifest = join(staging, 'postbus-national-day-manifest.json')
    const candidates = []
    if (reusableCachePath) {
      try { candidates.push(['reused', JSON.parse(await readFile(reusableCachePath, 'utf8'))]) }
      catch (error) {
        if (error.code !== 'ENOENT') console.warn(`Ignoring unreadable reusable road cache: ${error.message}`)
      }
    }
    candidates.push(['committed', JSON.parse(await readFile(cachePath, 'utf8'))])

    async function stageAndAudit(cache) {
      await rm(staging, { recursive: true, force: true })
      await mkdir(staging, { recursive: true })
      await copyFile(snapshotPath, stagedManifest)
      for (const chunk of day.chunks) {
        assert(/^postbus-national-day-chunks\/\d{2}-\d{2}\.json$/.test(chunk.descriptor.path), 'Unexpected PostBus chunk path')
        const target = join(staging, chunk.descriptor.path)
        await mkdir(dirname(target), { recursive: true })
        await copyFile(chunk.path, target)
      }
      await enrichPostbusRoads(stagedManifest, cache)
      return audit(stagedManifest)
    }

    let selected, report, source
    for (const [name, cache] of candidates) {
      try {
        const geometry = applyRoadCache(day.manifest, day.trains, cache)
        const coverage = geometry.total ? geometry.matched / geometry.total : 0
        console.log(`PostBus ${name} cache: ${(coverage * 100).toFixed(2)}%, ${geometry.missingPatterns} trips missing exact patterns`)
        if (coverage < 0.95) continue
        report = await stageAndAudit(cache)
        selected = cache
        source = name
        break
      } catch (error) {
        // A restored CI cache is only an optimisation, never trusted evidence.
        // A broken committed cache/code must still fail rather than be hidden.
        if (name !== 'reused') throw error
        console.warn(`Discarding invalid reusable road cache: ${error.message}`)
      }
    }
    if (!selected) {
      console.log(`Rebuilding PostBus roads for ${day.manifest.metadata.serviceDate}, feed ${day.manifest.metadata.feedVersion}`)
      selected = await build(day, directory)
      report = await stageAndAudit(selected)
      source = 'rebuilt'
    }
    // Validate everything before replacing chunks, then publish the manifest last.
    for (const [from, to] of [
      ...day.chunks.map(chunk => [join(staging, chunk.descriptor.path), chunk.path]),
      [stagedManifest, resolve(snapshotPath)],
    ]) {
      await copyFile(from, `${to}.tmp`)
      await rename(`${to}.tmp`, to)
    }
    if (reusableCachePath && source !== 'reused') {
      await mkdir(dirname(resolve(reusableCachePath)), { recursive: true })
      await writeFile(`${reusableCachePath}.tmp`, JSON.stringify(selected))
      await rename(`${reusableCachePath}.tmp`, reusableCachePath)
    }
    console.log(JSON.stringify({ source, ...report }))
    return { source, ...report }
  } finally {
    // Large OSM extracts and native build intermediates never become app assets.
    await rm(directory, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argument = name => {
    const index = process.argv.indexOf(`--${name}`)
    return index < 0 ? undefined : process.argv[index + 1]
  }
  await refreshPostbusRoads({ snapshotPath: argument('snapshot'), cachePath: argument('cache'),
    reusableCachePath: argument('reusable-cache'), workDirectory: argument('work-directory') })
}
