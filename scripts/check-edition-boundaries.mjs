import { access, lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { moduleReferences } from './module-references.mjs'

const root = resolve('.')
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
const declared = { ...manifest.dependencies, ...manifest.devDependencies }
if (manifest.workspaces) throw new Error('An edition must consume installed packages, not workspaces')
try { await access('packages'); throw new Error('Shared package source belongs in Motion Studies') }
catch (error) { if (error.code !== 'ENOENT') throw error }
const exported = new Map()
for (const shortName of ['core', 'data', 'three', 'web']) {
  const name = `@motionstudies/${shortName}`
  const version = declared[name]
  if (!/^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/.test(version ?? '')) throw new Error(`Expected an exact registry version: ${name}`)
  const locked = lock.packages[`node_modules/${name}`]
  if (locked?.version !== version || !locked.resolved?.startsWith('https://registry.npmjs.org/') || !locked.integrity?.startsWith('sha512-') || locked.link) throw new Error(`Registry lock mismatch: ${name}`)
  const installed = resolve('node_modules', name)
  if ((await lstat(installed)).isSymbolicLink() || !(await realpath(installed)).startsWith(`${await realpath('node_modules')}${sep}`)) throw new Error(`Shared source link: ${name}`)
  const pkg = JSON.parse(await readFile(`${installed}/package.json`, 'utf8'))
  if (pkg.version !== version || pkg.private !== false) throw new Error(`Installed release mismatch: ${name}`)
  exported.set(name, pkg.exports)
}

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name)
    if (entry.isDirectory()) { await visit(file); continue }
    if (!/\.(?:[cm]?[jt]sx?|css)$/.test(file)) continue
    for (const reference of moduleReferences(await readFile(file, 'utf8'), file)) {
      if (reference === undefined) throw new Error(`Unverifiable module reference in ${file}`)
      if (/^https?:/.test(reference) && extname(file) === '.css') continue
      if (reference.startsWith('.')) {
        const target = relative(root, resolve(dirname(file), reference))
        if (target === '..' || target.startsWith(`..${sep}`)) throw new Error(`${file} imports outside this repository`)
      } else {
        if (reference.startsWith('node:') || builtinModules.includes(reference)) continue
        const name = reference.startsWith('@') ? reference.split('/').slice(0, 2).join('/') : reference.split('/')[0]
        if (!declared[name]) throw new Error(`Undeclared dependency ${name} in ${file}`)
        if (exported.has(name) && !Object.hasOwn(exported.get(name), `.${reference.slice(name.length)}`)) throw new Error(`Private package import: ${reference}`)
      }
    }
  }
}
for (const directory of ['src', 'scripts', 'realtime-worker', 'astra-worker']) await visit(directory)
console.log('Gleislicht uses pinned npm releases and declared public imports.')
