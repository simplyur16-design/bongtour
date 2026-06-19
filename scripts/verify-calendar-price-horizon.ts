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
const horizonConstants = read('lib/calendar-price-horizon-constants.ts')
const batchSeq = read('lib/calendar-batch-seq-state.ts')

assert(horizonTs.includes('REGRESSION-FREEZE[calendar-price-horizon-180d]'), 'horizon TS marker missing')
assert(!horizonTs.includes('calendar-batch-seq-state'), 'horizon must not import fs-backed batch-seq-state')
assert(
  horizonConstants.includes('REGRESSION-FREEZE[calendar-price-horizon-180d]'),
  'horizon constants marker missing',
)
assert(/CALENDAR_PRICE_HORIZON_DAYS\s*=\s*180/.test(horizonConstants), 'horizon days must be 180 in constants leaf')
assert(/CALENDAR_PRICE_HORIZON_MONTHS_FORWARD\s*=\s*6/.test(horizonConstants), 'horizon months must be 6')
assert(
  horizonTs.includes('calendar-price-horizon-constants'),
  'horizon must import constants leaf',
)
assert(
  /CALENDAR_BATCH_HORIZON_DAYS\s*=\s*CALENDAR_PRICE_HORIZON_DAYS/.test(horizonConstants),
  'batch horizon days must alias constants leaf',
)
assert(batchSeq.includes('calendar-price-horizon-constants'), 'batch-seq-state must import days from constants leaf')

const bounds = read('lib/scrape-date-bounds.ts')
assert(
  /SCRAPE_DEFAULT_MONTHS_FORWARD\s*=\s*CALENDAR_PRICE_HORIZON_MONTHS_FORWARD/.test(bounds),
  'SCRAPE_DEFAULT_MONTHS_FORWARD must use horizon months SSOT',
)
assert(bounds.includes('calendar-price-horizon-constants'), 'bounds must import months from constants leaf')
assert(!/\bfrom ['"]@\/lib\/calendar-price-horizon['"]/.test(bounds), 'bounds must not import calendar-price-horizon (client bundle)')
assert(!bounds.includes('calendar-batch-seq-state'), 'bounds must not import fs-backed batch-seq-state')

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

const modetourScraper = read('scripts/calendar_e2e_scraper_modetour/calendar_price_scraper.py')
assert(modetourScraper.includes('REGRESSION-FREEZE[modetour-sweep-e2e-recheck]'), 'modetour E2E scraper marker missing')
assert(modetourScraper.includes('다른 출발일 보기'), 'modetour E2E must target 다른 출발일 보기 CTA')
assert(modetourScraper.includes('_wait_for_modetour_detail_ready'), 'modetour E2E must wait for detail shell')
assert(modetourScraper.includes('_modetour_modal_is_open'), 'modetour E2E must verify modal open')
assert(modetourScraper.includes('modetour-prices-ready'), 'modetour E2E must wait for calendar prices')
assert(modetourScraper.includes('cellRawText'), 'modetour E2E must parse td textContent')

const pyHorizon = read('scripts/calendar_e2e_common/horizon.py')
assert(pyHorizon.includes('CALENDAR_PRICE_HORIZON_MONTHS_FORWARD = 6'), 'python horizon months')

assert(fs.existsSync(path.join(root, 'docs/ops/calendar-price-horizon-contract.md')), 'contract doc missing')

if (failures.length) {
  console.error('verify-calendar-price-horizon FAILED:\n')
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}
console.log('verify-calendar-price-horizon OK')
