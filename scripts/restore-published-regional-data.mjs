import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readRegionalArtifacts, readRegionalDirectory } from './regional-artifacts.mjs'

export async function restorePublishedRegionalData(output, fetchData = fetch, bootstrapDirectory = 'public/data') {
  let bootstrap
  const { files, dates } = await readRegionalArtifacts(async path => {
    if (bootstrap?.has(path)) return bootstrap.get(path)
    const url = new URL(path, 'https://emmettl.github.io/gleislicht/data/')
    const response = await fetchData(url, { signal: AbortSignal.timeout(30_000) })
    // On the first Lausanne deployment there is no published fallback yet.
    // Only a missing manifest can select the complete, validated dated fixture;
    // a damaged or partially published study must never be mixed with it.
    if (path === 'lausanne-region-day-manifest.json' && response.status === 404) {
      bootstrap = (await readRegionalDirectory(bootstrapDirectory, ['lausanne-region'])).files
      return bootstrap.get(path)
    }
    if (!response.ok) throw new Error(`Published regional recovery: ${path} returned ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  })
  // No output changes until the complete published set passes validation.
  for (const [path, bytes] of files) {
    const destination = join(output, path)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, bytes)
  }
  console.log(`Retained verified regional service dates: ${JSON.stringify(dates)}`)
  return { files, dates }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await restorePublishedRegionalData(resolve(process.argv[2] ?? 'public/data'))
}
