/**
 * REGRESSION-FREEZE[pexels-primary-single-ingest]:
 * 대표 이미지 PATCH는 PhotoPool internalize 1회만 — 같은 CDN으로 rehostPexelsProductHeroIfNeeded 재호출 금지.
 */
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const patchRoute = path.join(ROOT, 'app/api/admin/products/[id]/route.ts')
const photoPool = path.join(ROOT, 'lib/photo-pool.ts')
const searchRoute = path.join(ROOT, 'app/api/admin/pexels/search/route.ts')
const pending = path.join(ROOT, 'app/admin/pending/components/AdminPendingDetailPanel.tsx')

function mustInclude(file: string, needles: string[]) {
  const text = fs.readFileSync(file, 'utf8')
  for (const n of needles) {
    if (!text.includes(n)) {
      console.error(`[fail] ${path.relative(ROOT, file)} missing: ${n}`)
      process.exit(1)
    }
  }
}

function mustNotInclude(file: string, needles: string[]) {
  const text = fs.readFileSync(file, 'utf8')
  for (const n of needles) {
    if (text.includes(n)) {
      console.error(`[fail] ${path.relative(ROOT, file)} must not include: ${n}`)
      process.exit(1)
    }
  }
}

mustInclude(patchRoute, [
  'REGRESSION-FREEZE[pexels-primary-single-ingest]',
  'internalizeProductCoverImageUrl',
  'PhotoPool internalize only',
])
mustNotInclude(patchRoute, ['rehostPexelsProductHeroIfNeeded'])

mustInclude(photoPool, [
  'REGRESSION-FREEZE[pexels-primary-single-ingest]',
  'findPhotoPoolBySourcePhotoId',
])

mustInclude(searchRoute, [
  'REGRESSION-FREEZE[pexels-primary-single-ingest]',
  'SEARCH_CACHE_TTL_MS',
  'cache-hit',
])

mustInclude(pending, [
  'REGRESSION-FREEZE[pexels-primary-single-ingest]',
  'firstPoiNamesFromItinerary',
  'use loaded itinerary',
])

console.log('[ok] verify-pexels-primary-single-ingest')
