import { readdir, readFile } from 'node:fs/promises'

const appFiles = await readdir('dist')
const remote = appFiles.includes('_data-release.json')
if (remote && appFiles.includes('data')) throw new Error('External data deployment must not bundle a second dataset')
const names = remote ? [] : await readdir('dist/data')
if (remote) {
  const pointer = JSON.parse(await readFile('dist/_data-release.json', 'utf8'))
  const host = JSON.parse(await readFile('config/data-host.json', 'utf8'))
  const { releaseRoot } = await import('./data-release.mjs')
  if (pointer.schemaVersion !== 1 || pointer.baseUrl !== releaseRoot(host.origin, host.prefix, pointer.id)) throw new Error('Invalid published data pointer')
  const response = await fetch(pointer.baseUrl + '_release.json', { signal: AbortSignal.timeout(30_000) })
  if (!response.ok || (await response.json()).id !== pointer.id) throw new Error('Data release is not complete')
}
const foreign = names.filter((name) => /^(all-change|correspondances|local-express)/.test(name))
if (foreign.length) throw new Error(`Foreign edition data in Swiss deployment: ${foreign.join(', ')}`)
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))
const entries = Object.entries(manifest).filter(([, chunk]) => chunk.isEntry).map(([key]) => key)
if (entries.length !== 1 || entries[0] !== 'index.html') throw new Error('Swiss deployment must have exactly one application entry')
for (const [file, target] of [['london.html', 'allchange'], ['paris.html', 'correspondances']]) {
  const html = await readFile(`dist/${file}`, 'utf8')
  if (!html.includes(`https://emmettl.github.io/${target}/`)) throw new Error(`Missing compatibility redirect: ${file}`)
}
if ((await readdir('dist')).includes('new-york.html')) throw new Error('New York publication remains withheld')
console.log('Swiss-only Pages artifact verified, with London and Paris compatibility redirects.')
