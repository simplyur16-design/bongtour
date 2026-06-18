/**
 * 참좋은여행 E2E — 판매종료 URL 선검사·product-expired phase 가드.
 * npx tsx scripts/verify-verygoodtour-e2e-expired-url-guard.ts
 *
 * REGRESSION-FREEZE[verygoodtour-e2e-expired-url-guard]: manifest
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures: string[] = []

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function assert(cond: boolean, msg: string) {
  if (!cond) failures.push(msg)
}

const health = read('lib/verygoodtour-detail-url-health.ts')
assert(
  health.includes('REGRESSION-FREEZE[verygoodtour-e2e-expired-url-guard]'),
  'detail-url-health marker missing',
)
assert(health.includes('isVerygoodtourDetailUrlExpired'), 'health helper missing')

const scraper = read('scripts/calendar_e2e_scraper_verygoodtour/calendar_price_scraper.py')
assert(scraper.includes('_verygood_page_is_product_expired'), 'scraper expired probe missing')
assert(scraper.includes('phase=product-expired'), 'scraper product-expired phase missing')

const smoke = read('scripts/smoke-calendar-scrapers-inspect.ts')
assert(smoke.includes('isVerygoodtourDetailUrlExpired'), 'smoke must pre-check verygood URL')
assert(smoke.includes('verygood-detail-url-stale'), 'smoke stale path tag missing')

if (failures.length) {
  console.error('verify-verygoodtour-e2e-expired-url-guard FAILED:\n')
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}
console.log('verify-verygoodtour-e2e-expired-url-guard OK')
