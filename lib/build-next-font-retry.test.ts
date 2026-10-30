import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { isNextFontFetchFlake } = require('../scripts/next-build-font-retry.cjs') as {
  isNextFontFetchFlake: (s: string) => boolean
}

describe('next-build-font-retry', () => {
  it('retries the next/font Google Fonts loader TypeError seen on 2026-10-30', () => {
    const log = [
      'Failed to compile.',
      "An error occurred in `next/font`.",
      "TypeError: Cannot read properties of null (reading '1')",
      '    at /app/node_modules/next/dist/compiled/@next/font/dist/google/loader.js:122:78',
    ].join('\n')
    expect(isNextFontFetchFlake(log)).toBe(true)
  })
  it('retries a plain Google Fonts fetch failure', () => {
    expect(isNextFontFetchFlake('Failed to fetch `Noto Sans KR` from Google Fonts.')).toBe(true)
  })
  it('does not retry real code errors', () => {
    expect(isNextFontFetchFlake("Type error: Property 'x' does not exist on type 'Y'.")).toBe(false)
    expect(isNextFontFetchFlake('Module not found: Can\'t resolve \'./missing\'')).toBe(false)
    expect(isNextFontFetchFlake('')).toBe(false)
  })
})
