import { createHash } from 'node:crypto'
import { lstat, readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

export const digest = bytes => createHash('sha256').update(bytes).digest('hex')
export function validateInventory(files) {
  if (!Array.isArray(files) || !files.length) throw new Error('Empty release inventory')
  let previous = ''
  for (const file of files) {
    if (typeof file.path !== 'string' || !/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(file.path) || file.path.split('/').some(part => part === '.' || part === '..') || file.path === '_release.json' || file.path <= previous) throw new Error('Unsafe or unordered release inventory')
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid release file metadata')
    previous = file.path
  }
}
export function releaseRoot(origin, prefix, id) {
  const url = new URL(origin)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Data origin must be a plain HTTPS origin')
  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(prefix) || !/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid data release path')
  return `${url.origin}/${prefix}/${id}/`
}

export async function inventory(directory) {
  const files = []
  async function walk(relative = '') {
    for (const name of (await readdir(join(directory, relative))).sort()) {
      const path = relative ? `${relative}/${name}` : name
      const stat = await lstat(join(directory, path))
      if (stat.isDirectory()) await walk(path)
      else if (stat.isFile()) {
        if (!/^[A-Za-z0-9._/-]+$/.test(path) || path.split('/').includes('..') || path === '_release.json') throw new Error(`Unsupported data path: ${path}`)
        const bytes = await readFile(join(directory, path))
        files.push({ path, bytes: bytes.length, sha256: digest(bytes) })
      } else throw new Error(`Data releases cannot contain links or special files: ${path}`)
    }
  }
  await walk()
  if (!files.length) throw new Error('Cannot publish an empty data release')
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}

export async function validateReferences(directory, files) {
  const byPath = new Map(files.map(file => [file.path, file]))
  for (const file of files) {
    if (!file.path.endsWith('.json')) continue
    const json = JSON.parse(await readFile(join(directory, file.path), 'utf8'))
    for (const chunk of json.chunks ?? []) {
      const name = chunk.path ?? chunk.file
      if (typeof name !== 'string') continue
      if (name.startsWith('/') || name.split('/').includes('..') || name.includes('://')) throw new Error(`Unsafe chunk reference in ${file.path}`)
      const target = byPath.get(posix.join(posix.dirname(file.path), name)) ?? byPath.get(name)
      if (!target) throw new Error(`Missing chunk ${name} referenced by ${file.path}`)
      if (chunk.bytes !== undefined && chunk.bytes !== target.bytes) throw new Error(`Chunk size mismatch: ${target.path}`)
      if (chunk.sha256 && chunk.sha256 !== target.sha256) throw new Error(`Chunk checksum mismatch: ${target.path}`)
      if (chunk.decodedSha256) {
        const decoded = gunzipSync(await readFile(join(directory, target.path)))
        if (digest(decoded) !== chunk.decodedSha256 || (chunk.decodedBytes !== undefined && decoded.length !== chunk.decodedBytes)) throw new Error(`Decoded chunk mismatch: ${target.path}`)
      }
    }
  }
}

export async function prepareRelease(directory, host) {
  const files = await inventory(directory)
  validateInventory(files)
  await validateReferences(directory, files)
  const id = digest(JSON.stringify(files))
  return { schemaVersion: 1, id, baseUrl: releaseRoot(host.origin, host.prefix, id), files, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = resolve(process.argv[2] ?? 'public/data')
  const output = resolve(process.argv[3] ?? '.data-release/release.json')
  const host = JSON.parse(await readFile('config/data-host.json', 'utf8'))
  const release = await prepareRelease(directory, host)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(release, null, 2) + '\n')
  console.log(JSON.stringify({ id: release.id, baseUrl: release.baseUrl, files: release.files.length, bytes: release.totalBytes, manifest: output }))
}
