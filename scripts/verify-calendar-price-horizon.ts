/**
 * 6개월(180일) 달력·출발일 가격 지평선 — SSOT 정합 가드.
 * npx tsx scripts/verify-calendar-price-horizon.ts
 *
 * REGRESSION-FREEZE[calendar-price-horizon-180d]: manifest
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

const horizonTs = read('lib/calendar-price-horizon.ts')
assert(horizonTs.includes('REGRESSION-FREEZE[calendar-price-horizon-180d]'), 'horizon TS marker missing')
assert(/CALENDAR_PRICE_HORIZON_DAYS\s*=\s*CALENDAR_BATCH_HORIZON_DAYS/.test(horizonTs), 'horizon days must alias batch SSOT')
assert(/CALENDAR_PRICE_HORIZON_MONTHS_FORWARD\s*=\s*6/.test(horizonTs), 'horizon months must be 6')

const bounds = read('lib/scrape-date-bounds.ts')
assert(
  /SCRAPE_DEFAULT_MONTHS_FORWARD\s*=\s*CALENDAR_PRICE_HORIZON_MONTHS_FORWARD/.test(bounds),
  'SCRAPE_DEFAULT_MONTHS_FORWARD must use horizon months SSOT',
)

const scheduler = read('scripts/calendar_price_scheduler.py')
assert(scheduler.includes('_run_modetour_calendar_api'), 'scheduler must use modetour API path')
assert(
  scheduler.includes('calendar-scrape-modetour-api'),
  'scheduler must call modetour API route',
)
assert(
  !/if st in \("ok", "fail"\):\s*\n\s*_advance_product_after_window/m.test(scheduler),
  'sequential batch must not advance cursor on fail',
)
assert(/if st == "ok":\s*\n\s*_advance_product_after_window/m.test(scheduler), 'cursor advances only on ok')

const hanatourScraper = read('scripts/calendar_e2e_scraper_hanatour/calendar_price_scraper.py')
assert(
  hanatourScraper.includes('HANATOUR_E2E_SCHEDULER_MAX_MONTHS") or "6"'),
  'hanatour scheduler default max months must be 6',
)

const hanatourMain = read('scripts/calendar_e2e_scraper_hanatour/scraper.py')
assert(hanatourMain.includes('e2e_date_from_month_nav'), 'hanatour must navigate to DATE_FROM month')

const ybtourPy = read('scripts/calendar_e2e_scraper_ybtour/calendar_price_scraper.py')
assert(ybtourPy.includes('CALENDAR_PRICE_HORIZON_MONTHS_FORWARD'), 'ybtour month limit must use horizon SSOT')
assert(ybtourPy.includes('align-date-from'), 'ybtour must align to YBTOUR_DATE_FROM when set')

const modetourApiRoute = read('app/api/admin/products/[id]/calendar-scrape-modetour-api/route.ts')
assert(modetourApiRoute.includes('collectModetourDepartureInputsForDateRange'), 'modetour API route must use B2C adapter')
assert(modetourApiRoute.includes('modetour-b2c-api'), 'modetour API route source tag')

const pyHorizon = read('scripts/calendar_e2e_common/horizon.py')
assert(pyHorizon.includes('CALENDAR_PRICE_HORIZON_MONTHS_FORWARD = 6'), 'python horizon months')

assert(fs.existsSync(path.join(root, 'docs/ops/calendar-price-horizon-contract.md')), 'contract doc missing')

if (failures.length) {
  console.error('verify-calendar-price-horizon FAILED:\n')
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}
console.log('verify-calendar-price-horizon OK')
