import { readFile, mkdir, cp } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Preserve the reviewed checkout's weekday inputs before live aliases are
// replaced. Orbital can still choose a newer weekday alias when one exists.
export async function preserveOrbitalWeekdays(root = 'public/data') {
  const retained = []
  for (const id of ['swiss-rail', 'postbus-national', 'zurich-city', 'zvv-region', 'geneva-tpg', 'lausanne-region']) {
    const name = `${id}-day-manifest.json`
    const manifest = JSON.parse(await readFile(join(root, name), 'utf8'))
    const date = manifest.metadata?.serviceDate
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error(`${id}: missing weekday source date`)
    const day = new Date(`${date}T12:00:00Z`).getUTCDay()
    if (day === 0 || day === 6) continue
    const prefix = `weekday/${date}/`
    for (const file of [name, ...manifest.chunks.map(chunk => chunk.path)]) {
      if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*\.json$/.test(file)) throw new Error(`${id}: unsafe weekday source path`)
      await mkdir(dirname(join(root, prefix, file)), { recursive: true })
      await cp(join(root, file), join(root, prefix, file))
    }
    retained.push({ id, date, file: prefix + name })
  }
  return retained
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(await preserveOrbitalWeekdays(process.argv[2]))
