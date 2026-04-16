/**
 * 참좋은여행 상품 EPP0211-260426LO 상세 페이지에서 가져온 일정 스니펫(픽스처)으로
 * `extractVerygoodScheduleRowsFromPasteBody` → `polishVerygoodRegisterScheduleDescriptions` 검증.
 *
 * 실행: `npx tsx tools/verify-verygood-epp0211-body.ts`
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { extractVerygoodScheduleRowsFromPasteBody } from '@/lib/verygoodtour-schedule-blocks-from-paste'
import { polishVerygoodRegisterScheduleDescriptions } from '@/lib/verygoodtour-schedule-description-polish'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturePath = path.join(__dirname, 'fixtures', 'verygood-epp0211-itinerary-snippet.txt')
const fixture = fs.readFileSync(fixturePath, 'utf8')

const extracted = extractVerygoodScheduleRowsFromPasteBody(fixture)
console.log('URL: https://www.verygoodtour.com/Product/PackageDetail?ProCode=EPP0211-260426LO&PriceSeq=1')
console.log('extractVerygoodScheduleRowsFromPasteBody log:', JSON.stringify(extracted.log, null, 2))
console.log('rows:', extracted.rows.length)

const polished = polishVerygoodRegisterScheduleDescriptions(extracted.rows.map((r) => ({ ...r })))

for (const r of polished) {
  const orig = extracted.rows.find((x) => x.day === r.day)
  const raw = (orig?.description ?? '').replace(/\s+/g, ' ').trim()
  console.log('\n==========', r.day, '일차 ==========')
  console.log('title:', r.title)
  console.log('원문 desc (앞 240자):', raw.slice(0, 240) + (raw.length > 240 ? '…' : ''))
  console.log('개선 desc:', r.description)
}
