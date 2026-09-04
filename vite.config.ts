import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // One relative build works locally, on the private iteration site and later under
  // the /gleislicht/ project path used by GitHub Pages.
  base: './',
  build: {
    target: 'es2022',
  },
})
