import type { Plugin } from 'vite'
import topology from '../public/data/swiss-road-topology.json' with { type: 'json' }

/** Extract the small road catalogue on the server in both dev and builds.
 * Vite cannot serve a JavaScript import from public/, and serving the whole
 * topology would defeat the catalogue's lazy, geometry-free search path.
 */
export function gleislichtRoadCatalogue(): Plugin {
  const moduleId = '\0gleislicht-road-catalogue'
  let catalogueFile: string
  return {
    name: 'gleislicht-road-catalogue',
    enforce: 'pre',
    configResolved(config) {
      catalogueFile = `${config.root}/src/editions/switzerland-roads.ts`
    },
    resolveId(source, importer) {
      if (importer?.split('?')[0] === catalogueFile && source === '../../public/data/swiss-road-topology.json') return moduleId
    },
    load(id) {
      if (id !== moduleId) return
      return `export const roads = ${JSON.stringify(topology.roads)};`
    },
  }
}
