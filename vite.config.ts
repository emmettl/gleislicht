import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { gleislichtSelectionRenderer } from './scripts/gleislicht-selection-renderer.ts'
export default defineConfig({
  plugins: [gleislichtSelectionRenderer(), react()],
  optimizeDeps: {
    exclude: ['@motionstudies/three'],
    include: ['@react-three/fiber', 'three'],
  },
  base: './',
  build: { manifest: true, target: 'es2022' },
})
