import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    exclude: ['node_modules', 'tests/**', '.next', 'dist', '_bundle3i_tmp', '_files_zip_tmp'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
