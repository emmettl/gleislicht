import { readFile } from 'node:fs/promises'
import { releaseRoot } from './data-release.mjs'

/** Resolve once so recovery cannot mix two published versions. */
export async function publishedDataRoot(fetchData = fetch) {
  const response = await fetchData('https://motionstudies.app/gleislicht/_data-release.json', { signal: AbortSignal.timeout(30_000), cache: 'no-store' })
  // Transition support for the last app deployed before external storage.
  if (response.status === 404) return 'https://emmettl.github.io/gleislicht/data/'
  if (!response.ok) throw new Error(`Published data pointer returned ${response.status}`)
  const pointer = await response.json()
  const host = JSON.parse(await readFile(new URL('../config/data-host.json', import.meta.url), 'utf8'))
  if (pointer.schemaVersion !== 1 || pointer.baseUrl !== releaseRoot(host.origin, host.prefix, pointer.id)) throw new Error('Invalid published data pointer')
  return pointer.baseUrl
}
