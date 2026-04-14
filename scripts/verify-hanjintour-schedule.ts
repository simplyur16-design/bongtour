/**
 * KW36098 상세 URL → 일정 DOM 보강 → schedule[] 검증
 * npx tsx scripts/verify-hanjintour-schedule.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { runHanjintourParseAndRegisterDev } from '../DEV/lib/parse-and-register-hanjintour-orchestration'

const url =
  'https://www.hanjintravel.com/dp/display/displayDetail?gdsNo=KW36098&evtNo=OP20260417377'
const htmlPath = join(process.cwd(), 'DEV/fixtures/hanjintour-kw36098-detail.html')
const detailHtml = readFileSync(htmlPath, 'utf8')

async function main() {
  const r = await runHanjintourParseAndRegisterDev({
    detailHtml,
    detailUrl: url,
    runScraper: false,
  })

  const out = {
    schedule_len: r.base.schedule.length,
    parse_notes: r.base.parse_notes,
    days_1_3: r.base.schedule.slice(0, 3),
    derived_sample: r.derived_products.slice(0, 2).map((d) => ({
      key: d.derived_product_key.slice(0, 16),
      title: d.display_title.slice(0, 80),
      schedule_days: d.base_common.schedule.length,
    })),
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
