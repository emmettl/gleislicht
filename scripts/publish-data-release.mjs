import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { digest, releaseRoot, validateInventory } from './data-release.mjs'

// Archived source HTML is evidence. Serve its original bytes as text to prevent
// CDN HTML rewriting and execution of scripts from the archived third party.
const TYPES = { '.json': 'application/json', '.gz': 'application/gzip', '.html': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.jpg': 'image/jpeg', '.zip': 'application/zip' }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
export async function request(url, options, attempts = 5) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response
    try { response = await fetch(url, { ...options, signal: AbortSignal.timeout(90_000) }) } catch (error) { if (attempt === attempts - 1) throw error }
    if (response && ![429, 500, 502, 503, 504].includes(response.status)) return response
    await response?.body?.cancel()
    if (attempt < attempts - 1) await delay(Math.min(30_000, 1000 * 2 ** attempt))
  }
  throw new Error('Data host request failed after retries')
}
async function eachLimit(items, task, concurrency = 4) {
  let index = 0, completed = 0, failed = false
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (!failed && index < items.length) {
      const item = items[index++]
      try { await task(item) } catch (error) { failed = true; throw error }
      completed++
      if (completed % 50 === 0 || completed === items.length) console.log(`${completed}/${items.length} files`)
    }
  }))
}
export async function verifyFile(baseUrl, file) {
  const response = await request(baseUrl + file.path, { headers: { Origin: 'https://motionstudies.app' } })
  if (!response.ok) throw new Error(`Data verification returned ${response.status}: ${file.path}`)
  if (response.headers.get('access-control-allow-origin') !== '*') throw new Error(`Missing public browser access: ${file.path}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error(`Published bytes differ: ${file.path}`)
}
export function createR2Uploader(host, credentials) {
  if (!credentials?.accessKeyId || !credentials?.secretAccessKey) throw new Error('CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY are required for publication')
  const client = new S3Client({
    region: 'auto', endpoint: `https://${host.accountId}.r2.cloudflarestorage.com`,
    credentials, maxAttempts: 5, requestChecksumCalculation: 'WHEN_REQUIRED',
  })
  return input => client.send(new PutObjectCommand(input))
}
export async function publishRelease(directory, release, host, credentials, { verifyOnly = false, putObject } = {}) {
  validateInventory(release.files)
  if (release.totalBytes !== release.files.reduce((sum, file) => sum + file.bytes, 0)) throw new Error('Invalid release byte total')
  if (release.schemaVersion !== 1 || digest(JSON.stringify(release.files)) !== release.id || release.baseUrl !== releaseRoot(host.origin, host.prefix, release.id)) throw new Error('Invalid release identity')
  const existing = await request(release.baseUrl + '_release.json')
  if (existing.ok) {
    const published = await existing.json()
    if (JSON.stringify(published) !== JSON.stringify(release)) throw new Error('Existing immutable release differs')
    console.log('Release already published; verifying files')
  } else {
    if (existing.status !== 404) throw new Error(`Cannot establish release state: HTTP ${existing.status}`)
    if (verifyOnly) throw new Error('Release is not published')
    putObject ??= createR2Uploader(host, credentials)
    console.log('Uploading immutable data files')
    await eachLimit(release.files, async file => {
      const bytes = await readFile(join(directory, file.path))
      if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error(`Source changed since preparation: ${file.path}`)
      const type = Object.entries(TYPES).find(([extension]) => file.path.endsWith(extension))?.[1] ?? 'application/octet-stream'
      await putObject({
        Bucket: host.bucket, Key: `${host.prefix}/${release.id}/${file.path}`,
        ContentType: type, CacheControl: 'public, max-age=31536000, immutable', Body: bytes,
      })
    })
  }
  console.log('Verifying every file through the public data domain')
  await eachLimit(release.files, file => verifyFile(release.baseUrl, file))
  if (!existing.ok) {
    await putObject({
      Bucket: host.bucket, Key: `${host.prefix}/${release.id}/_release.json`,
      ContentType: 'application/json', CacheControl: 'public, max-age=31536000, immutable', Body: JSON.stringify(release),
    })
  }
  const complete = await request(release.baseUrl + '_release.json')
  if (!complete.ok || JSON.stringify(await complete.json()) !== JSON.stringify(release)) throw new Error('Published release manifest verification failed')
  return { schemaVersion: release.schemaVersion, id: release.id, baseUrl: release.baseUrl }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const release = JSON.parse(await readFile(process.argv[2] ?? '.data-release/release.json', 'utf8'))
  const directory = resolve(process.argv[3] ?? 'public/data')
  const host = JSON.parse(await readFile('config/data-host.json', 'utf8'))
  const credentials = { accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY }
  const pointer = await publishRelease(directory, release, host, credentials, { verifyOnly: process.argv.includes('--verify-only') })
  if (!process.argv.includes('--verify-only')) await writeFile('src/editions/data-release.json', JSON.stringify(pointer, null, 2) + '\n')
  console.log(`Verified data release: ${pointer.baseUrl}`)
}
