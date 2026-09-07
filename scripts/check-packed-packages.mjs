import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn, spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { buildPackages, packageNames, packageOutput, run } from './build-packages.mjs'

const root = resolve('.')
await buildPackages()
const tarballs = join(packageOutput, 'tarballs')
await mkdir(tarballs, { recursive: true })
const dependencies = {}
for (const name of packageNames) {
  const result = spawnSync('npm', ['pack', join(packageOutput, name), '--json', '--pack-destination', tarballs, '--cache', join(packageOutput, 'npm-cache')], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'npm pack failed')
  const [packed] = JSON.parse(result.stdout)
  for (const { path } of packed.files) {
    if (path.includes('.test.') || path.startsWith('src/') || (/\.tsx?$/.test(path) && !path.endsWith('.d.ts'))) {
      throw new Error(`${name} ships source or tests: ${path}`)
    }
  }
  dependencies[`@motionstudies/${name}`] = `file:${join(tarballs, packed.filename)}`
}
const consumer = await mkdtemp(join(tmpdir(), 'motion-studies-consumer-'))
console.log(`Checking an isolated consumer at ${consumer}`)
let server
try {
  await cp(resolve('lab'), consumer, { recursive: true, filter: (source) => !['dist', 'node_modules', 'e2e'].includes(source.split('/').at(-1)) })
  const labManifest = JSON.parse(await readFile(join(consumer, 'package.json'), 'utf8'))
  // Pin installed tool/peer versions. npm installs real tarballs, never workspace links.
  for (const name of Object.keys({ ...labManifest.dependencies, ...labManifest.devDependencies })) {
    if (name.startsWith('@motionstudies/')) continue
    dependencies[name] = JSON.parse(await readFile(resolve('node_modules', name, 'package.json'), 'utf8')).version
  }
  await writeFile(join(consumer, 'package.json'), `${JSON.stringify({ name: 'motion-studies-packed-consumer', version: '0.0.0', private: true, type: 'module', dependencies }, null, 2)}\n`)
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], { cwd: consumer })
  for (const name of packageNames) {
    const installed = join(consumer, 'node_modules/@motionstudies', name)
    if ((await lstat(installed)).isSymbolicLink() || !(await realpath(installed)).startsWith(await realpath(consumer))) throw new Error(`${name} is not an isolated package install`)
  }
  await writeFile(join(consumer, 'src/package-contracts.ts'), `
    import { network } from './fixtures.ts'
    import { parseGtfsTime, activeServices } from '@motionstudies/data/gtfs'
    import { chunkNetworkSnapshot } from '@motionstudies/data/network-chunks'
    import { mergeNetworkSnapshots } from '@motionstudies/data/merge-network'
    import { rankNetworkStations } from '@motionstudies/data/station-ranking'
    export const seconds: number = parseGtfsTime('25:10:00')
    export const chunkCount: number = chunkNetworkSnapshot(network, 120, 'chunks').chunks.length
    export const merged = mergeNetworkSnapshots([network])
    export const ranks: number[] = rankNetworkStations(network).map((entry) => entry.labelRank)
    export const readServices: (archive: string, date: string) => Promise<Set<string>> = activeServices
  `)
  const smoke = `
    import { readFile } from 'node:fs/promises'
    for (const name of ${JSON.stringify(packageNames)}) {
      const manifest = JSON.parse(await readFile(new URL('./node_modules/@motionstudies/'+name+'/package.json', import.meta.url), 'utf8'))
      for (const path of Object.keys(manifest.exports)) {
        if (path.endsWith('.css')) continue
        await import('@motionstudies/'+name+'/'+path.slice(2))
      }
    }
    for (const hidden of ['@motionstudies/web/use-progressive-chunks', '@motionstudies/three/network-paths']) {
      try { await import(hidden); throw new Error('Internal module exposed: '+hidden) }
      catch (error) { if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error }
    }
    const { parseGtfsTime } = await import('@motionstudies/data/gtfs')
    if (parseGtfsTime('25:10:00') !== 90600) throw new Error('Packed Node tooling failed')
  `
  await writeFile(join(consumer, 'smoke.mjs'), smoke)
  run(process.execPath, ['smoke.mjs'], { cwd: consumer })
  run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { cwd: consumer })
  run(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { cwd: consumer })
  // A packed production build must contain no app/workspace imports or source paths.
  const assets = await readdir(join(consumer, 'dist/assets'))
  for (const asset of assets.filter((file) => file.endsWith('.js'))) {
    const text = await readFile(join(consumer, 'dist/assets', asset), 'utf8')
    if (text.includes(root) || /@motionstudies\/[^'"\s]+\.tsx?/.test(text)) throw new Error(`Workspace source leaked into ${asset}`)
  }
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { cwd: consumer, stdio: 'inherit' })
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Packed consumer preview exited early')
    try { ready = (await fetch('http://127.0.0.1:4175/')).ok } catch { /* Server is starting. */ }
    if (ready) break
    await delay(100)
  }
  if (!ready) throw new Error('Packed consumer preview did not start')
  run(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.lab.config.ts'], {
    env: { ...process.env, MOTION_LAB_URL: 'http://127.0.0.1:4175' },
  })
  console.log('Packed consumer passed: public imports, declarations, Node tooling, lab build and browser specimens.')
} finally {
  if (server) {
    const exited = new Promise((done) => server.once('close', done))
    if (server.exitCode === null && server.signalCode === null) { server.kill(); await exited }
  }
  await rm(consumer, { recursive: true, force: true })
}
