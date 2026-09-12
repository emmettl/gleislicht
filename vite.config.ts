import calendar from './src/editions/timetable-calendar.json' with { type: 'json' }
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { cp, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { gleislichtOrbitalRenderer } from './scripts/gleislicht-orbital-renderer.ts'
import { gleislichtSelectionRenderer } from './scripts/gleislicht-selection-renderer.ts'
import { gleislichtRoadRenderer } from './scripts/gleislicht-road-renderer.ts'
import { gleislichtAirportRenderer } from './scripts/gleislicht-airport-renderer.ts'
import { gleislichtSurfaceRenderer } from './scripts/gleislicht-surface-renderer.ts'
import { gleislichtPostbusRenderer } from './scripts/gleislicht-postbus-renderer.ts'
import { gleislichtPerformanceRenderer } from './scripts/gleislicht-performance-renderer.ts'
import release from './src/editions/data-release.json' with { type: 'json' }
import { resolveDataRoot } from './src/editions/data-root.ts'
/** Copy public documents and icons, while datasets have their own release. */
function publicAppAssets(baseUrl: string, realtimeUrl?: string): Plugin {
  let root: string, output: string
  return {
    name: 'gleislicht-public-app-assets',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_data-release.json', source: JSON.stringify({ ...release, baseUrl }) + '\n' })
      if (calendar.days.length) this.emitFile({ type: 'asset', fileName: '_timetable-calendar.json', source: JSON.stringify({ ...calendar, baseUrl, realtimeUrl }) + '\n' })
    },
    configResolved(config) { root = config.publicDir; output = resolve(config.root, config.build.outDir) },
    async closeBundle() {
      for (const entry of await readdir(root, { withFileTypes: true })) {
        if (entry.name === 'data') continue
        await cp(resolve(root, entry.name), resolve(output, entry.name), { recursive: true })
      }
    },
  }
}
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const bundledData = command === 'serve' || env.VITE_GLEISLICHT_BUNDLE_DATA === '1'
  const dataRoot = resolveDataRoot({ override: env.VITE_GLEISLICHT_DATA_URL, published: release.baseUrl, local: './data/', development: bundledData })
  return {
    define: { 'import.meta.env.VITE_GLEISLICHT_RESOLVED_DATA_URL': JSON.stringify(dataRoot) },
    plugins: [...(bundledData ? [] : [publicAppAssets(dataRoot, env.VITE_GLEISLICHT_REALTIME_URL)]), gleislichtSelectionRenderer(), gleislichtRoadRenderer(), gleislichtAirportRenderer(), gleislichtSurfaceRenderer(), gleislichtPostbusRenderer(), gleislichtPerformanceRenderer(), gleislichtOrbitalRenderer(), react()],
    optimizeDeps: {
      // Archived source HTML under data/ is evidence, not an application entry.
      entries: ['index.html'],
      exclude: ['@motionstudies/three'],
      include: ['@react-three/fiber', 'three'],
    },
    base: './',
    build: { manifest: true, target: 'es2022', copyPublicDir: bundledData },
  }
})
