import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * REGRESSION-FREEZE[heal-never-write-product-title]: heal/repair paths must not persist Product.title — manifest
 */
const HEAL_SOURCE_FILES = [
  'lib/register-pending-pre-photo-self-heal.ts',
  'lib/register-pre-photo-self-heal.ts',
  'lib/register-pre-photo-country-schedule-self-heal.ts',
  'lib/register-pre-photo-pending-open-heal.ts',
  'lib/register-pre-photo-lane-rematerialize.ts',
  'lib/register-pre-photo-listing-ingest.ts',
  'lib/register-pre-photo-queue-flags.ts',
  'app/api/cron/register-pre-photo-self-heal/route.ts',
  'app/api/admin/products/[id]/pre-photo-heal/route.ts',
] as const

/** product.update / updateMany data payloads that write Product.title */
const PRODUCT_TITLE_WRITE_RE =
  /product\.(?:update|updateMany)\s*\(\s*\{[\s\S]{0,1200}?data\s*:\s*\{[\s\S]{0,1200}?(?<![A-Za-z.])title\s*:/

describe('heal-never-write-product-title', () => {
  it('pending self-heal keeps cleaned title for infer only (no title write plumbing)', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'lib/register-pending-pre-photo-self-heal.ts'),
      'utf8',
    )
    expect(src).toContain('REGRESSION-FREEZE[heal-never-write-product-title]')
    expect(src).toContain('normalizeSupplierRegisterListingTitle')
    expect(src).toContain('titleForInfer')
    expect(src).not.toContain('titleChanged')
    expect(src).not.toContain('title: cleanedTitle')
    expect(src).not.toMatch(/titleChanged\s*\?\s*\{\s*title\s*:/)
  })

  it('heal/repair/backfill sources never put title in prisma product.update data', () => {
    for (const rel of HEAL_SOURCE_FILES) {
      const full = path.join(process.cwd(), rel)
      let src: string
      try {
        src = readFileSync(full, 'utf8')
      } catch {
        continue
      }
      expect(src, rel).not.toMatch(PRODUCT_TITLE_WRITE_RE)
      expect(src, rel).not.toContain('title: cleanedTitle')
      expect(src, rel).not.toMatch(/\.\.\.\s*titlePatch\b/)
    }
  })
})
