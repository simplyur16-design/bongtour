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
assert(modetourApiRoute.includes('resolveModetourDetailByOriginCode'), 'modetour API route must resolve originCode before B2C API')
assert(modetourApiRoute.includes('isModetourSd1NotFoundError'), 'modetour API route must handle SD1 without 500')
assert(modetourApiRoute.includes("apiStatus: 'sd1'"), 'modetour API route must tag SD1 responses')

const horizonRoute = read('app/api/admin/products/[id]/calendar-scrape-horizon/route.ts')
assert(horizonRoute.includes('REGRESSION-FREEZE[calendar-batch-api-first]'), 'horizon route marker missing')
assert(horizonRoute.includes('collectCalendarHorizonPriceInputs'), 'horizon route must use collect helper')
assert(horizonRoute.includes('calendar-scrape-horizon'), 'horizon route doc path')

const horizonCollect = read('lib/calendar-scrape-horizon-collect.ts')
assert(horizonCollect.includes('REGRESSION-FREEZE[calendar-batch-api-first]'), 'horizon collect marker missing')
assert(horizonCollect.includes('collectHanatourApiOnlyForDateRange'), 'hanatour API-only in batch collect')
assert(horizonCollect.includes('collectKyowontourApiOnlyForDateRange'), 'kyowontour API-only in batch collect')
assert(!horizonCollect.includes('collectHanatourPriceInputsWithE2eFallback'), 'batch collect must not use E2E fallback')
assert(!horizonCollect.includes('collectYbtourPriceInputsWithE2eFallback'), 'batch collect must not use ybtour E2E fallback')

assert(scheduler.includes('_run_horizon_calendar_api'), 'scheduler must use horizon Node API path')
assert(scheduler.includes('calendar-scrape-horizon'), 'scheduler must call horizon API route')
assert(scheduler.includes('_HORIZON_BATCH_NODE_SITES'), 'scheduler batch site set missing')
assert(
  /if product and date_rng:\s*\n\s*lo, hi = date_rng/m.test(scheduler),
  'scheduler must route batch windows through Node API first',
)

const batchEnv = read('lib/calendar-batch-env.ts')
assert(batchEnv.includes('REGRESSION-FREEZE[calendar-batch-retired-daily-sweep-ssot]'), 'batch env retired marker missing')
assert(
  /ENABLE_INSTRUMENTATION_CALENDAR_CRON !== '1'/.test(batchEnv),
  '3h calendar cron must require ENABLE_INSTRUMENTATION_CALENDAR_CRON=1 (default off)',
)

const contractDoc = read('docs/ops/calendar-price-horizon-contract.md')
assert(contractDoc.includes('E2E(브라우저)는 3h 배치에서 돌리지 않는다') || contractDoc.includes('3h sequential batch(calendar cron) — 기본 비활성'), 'contract must retire default 3h batch')
assert(contractDoc.includes('calendar-batch-retired-daily-sweep-ssot'), 'contract must reference retired manifest id')

const prodStability = read('docs/ops/production-stability-root-cause.md')
assert(prodStability.includes('DISABLE_WEB_SUPPLIER_SWEEP_CRON'), 'prod stability must document web sweep fallback kill switch')

const supplierSweepCrontab = read('lib/instrumentation-supplier-sweep-crontab.ts')
assert(supplierSweepCrontab.includes('REGRESSION-FREEZE[supplier-sweep-web-fallback]'), 'supplier sweep crontab marker missing')

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
