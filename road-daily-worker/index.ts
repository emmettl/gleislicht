import topology from '../public/data/swiss-road-topology.json'
import { compileDailyArchive, previousSwissDate, type ArchiveIO } from './analysis.ts'
import type { AstraSnapshot } from '../scripts/astra-measured-data.mjs'

interface Env { OBSERVATIONS: R2Bucket }

export async function decodeObject(object: R2ObjectBody) {
  // R2 bindings return the stored bytes, including gzip content encoding.
  const bytes = await object.arrayBuffer()
  const prefix = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength))
  return prefix[0] === 31 && prefix[1] === 139
    ? new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(bytes)
}

export function archiveIO(bucket: R2Bucket): ArchiveIO {
  const readJson = async (key: string) => {
    const object = await bucket.get(key)
    return object ? JSON.parse(await decodeObject(object)) : null
  }
  return {
    readJson,
    readRecording: async key => await readJson(key) as AstraSnapshot | null,
    async write(key, value) {
      if (!key.startsWith('road-history/')) throw new Error('Refusing to write outside the derived archive')
      const compressed = key.endsWith('.gz')
      const body = compressed
        ? await new Response(new Blob([value]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()
        : value
      await bucket.put(key, body, { httpMetadata: { contentType: key.endsWith('.csv.gz') ? 'text/csv' : 'application/json', ...(compressed ? { contentEncoding: 'gzip' } : {}) } })
    },
    async promote(key, pointer) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = await bucket.get(key)
        if (current && JSON.parse(await decodeObject(current)).serviceDate >= pointer.serviceDate) return
        const written = await bucket.put(key, JSON.stringify(pointer) + '\n', {
          onlyIf: current ? { etagMatches: current.etag } : { etagDoesNotMatch: '*' },
          httpMetadata: { contentType: 'application/json' },
        })
        if (written) return
      }
      throw new Error('Latest recording changed concurrently; retry promotion')
    },
  }
}

export default {
  async scheduled(controller, env): Promise<void> {
    const serviceDate = previousSwissDate(new Date(controller.scheduledTime))
    const manifest = await compileDailyArchive(archiveIO(env.OBSERVATIONS), topology, serviceDate)
    console.log(JSON.stringify({ serviceDate, ...manifest.metadata }))
    if (!manifest.metadata.complete) throw new Error(`Incomplete national road day ${serviceDate}; previous complete archive retained`)
  },
} satisfies ExportedHandler<Env>
