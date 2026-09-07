import { readdir, readFile } from 'node:fs/promises'

const names = await readdir('dist/data')
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
