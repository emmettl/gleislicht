import type { Plugin } from 'vite'

/** Camera handover hooks for the pinned atlas renderer; fail on upstream drift. */
export function gleislichtOrbitalRenderer(): Plugin {
  return {
    name: 'gleislicht-orbital', enforce: 'pre',
    transform(source, id) {
      if (!id.split('?')[0].replaceAll('\\', '/').endsWith('/@motionstudies/three/NationalNetworkScene.js')) return
      let code = source
      const replace = (before: string, after: string) => {
        if (code.split(before).length !== 2) throw new Error(`Gleislicht orbital hook needs review: ${before}`)
        code = code.replace(before, after)
      }
      replace('const currentTarget = useMemo(() => new THREE.Vector3(), []);',
        'const currentTarget = useMemo(() => new THREE.Vector3(), []);\n    const flightStep = useAtlasFlightCamera(camera, currentTarget, airProjection);')
      const start = code.indexOf('function NetworkCamera(')
      const frame = code.indexOf('useFrame((_, delta) => {', start)
      if (start < 0 || frame < 0) throw new Error('Atlas camera frame hook needs review')
      const at = frame + 'useFrame((_, delta) => {'.length
      code = code.slice(0, at) + '\n        if (flightStep()) return;' + code.slice(at)
      replace('return (_jsxs(Canvas, { camera:', 'return (_jsxs(Canvas, { frameloop: useAtlasFlightLoop(), camera:')
      return { code: 'import { useAtlasFlightCamera, useAtlasFlightLoop } from "/src/studies/atlas-flight-camera.ts";\n' + code, map: null }
    },
  }
}
