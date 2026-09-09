import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./src/test/platform.ts'],
    exclude: ['**/e2e/**', '**/node_modules/**', '**/dist/**', '.package-dist/**', '.claude/**'],
  },
})
