import { defineConfig } from 'vitest/config'
import path from 'node:path'

// REGRESSION-FREEZE[simplyur-mobile-inapp-eximbay-checkout]: vitest include apps/simplyur-mobile — manifest
// REGRESSION-FREEZE[simplyur-mobile-vitest-tsconfig]: apps/simplyur-mobile tsconfig standalone (no expo extend) — manifest
export default defineConfig({
  test: {
    include: [
      'lib/**/*.test.ts',
      'app/**/*.test.ts',
      'apps/simplyur-mobile/src/**/*.test.ts',
    ],
    exclude: ['node_modules', 'tests/**', '.next', 'dist', '_bundle3i_tmp', '_files_zip_tmp'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
