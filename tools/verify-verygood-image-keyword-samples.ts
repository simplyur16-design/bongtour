/**
 * 참좋은여행 Plan A imageKeyword/imageKeyword2 resolver 실측.
 * 실행: npx tsx tools/verify-verygood-image-keyword-samples.ts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { extractVerygoodScheduleRowsFromPasteBody } from '@/lib/verygoodtour-schedule-blocks-from-paste'
import {
  applyVerygoodScheduleImageKeywordsToRows,
  classifyVerygoodDayKind,
  extractVerygoodOrderedDayPoi,
  isVerygoodCrossContinentHallucinationKeyword,
  isVerygoodDomesticHubToken,
} from '@/lib/verygoodtour-schedule-image-keyword'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function auditKeyword(label: string, kw: string | null | undefined, dest: string): void {
  if (!kw) return
  if (isVerygoodDomesticHubToken(kw)) {
    console.warn(`  [WARN] ${label} domestic hub: ${kw}`)
  }
  if (isVerygoodCrossContinentHallucinationKeyword(kw, dest)) {
    console.warn(`  [WARN] ${label} cross-continent hallucination: ${kw}`)
  }
}

const fixturePath = path.join(__dirname, 'fixtures', 'verygood-epp0211-itinerary-snippet.txt')
const fixture = fs.readFileSync(fixturePath, 'utf8')
const extracted = extractVerygoodScheduleRowsFromPasteBody(fixture)
const d1 = extracted.rows.find((r) => r.day === 1)!
const d2 = extracted.rows.find((r) => r.day === 2)!

console.log('\n=== extractVerygoodOrderedDayPoi EPP0211 day2 ===')
const day2Pois = extractVerygoodOrderedDayPoi(d2.description, d2.title)
console.log('  pois:', JSON.stringify(day2Pois))
console.log('  dayKind:', classifyVerygoodDayKind(d2.description, d2.title, 2, 9))

type SimCase = {
  name: string
  productDestination: string
  rows: Parameters<typeof applyVerygoodScheduleImageKeywordsToRows>[0]
  detRows?: typeof extracted.rows
  note?: string
}

const cases: SimCase[] = [
  {
    name: 'EPP0211 day1 flight + LLM Warsaw',
    productDestination: 'Poland Baltic',
    detRows: [d1],
    rows: [
      {
        day: 1,
        title: d1.title,
        description: d1.description,
        imageKeyword: 'Warsaw',
        imageKeyword2: null,
      },
    ],
  },
  {
    name: 'EPP0211 day1 flight + LLM 빈값 (A 한계: det 미사용 → "")',
    productDestination: 'Poland Baltic',
    detRows: [d1],
    rows: [
      {
        day: 1,
        title: d1.title,
        description: d1.description,
        imageKeyword: '',
        imageKeyword2: null,
      },
    ],
  },
  {
    name: 'day2 touring + LLM Lazienki/Sigismund',
    productDestination: 'Poland',
    rows: [
      {
        day: 2,
        title: d2.title,
        description: d2.description,
        imageKeyword: 'Lazienki Park',
        imageKeyword2: 'Sigismund Column',
      },
    ],
    detRows: [d2],
  },
  {
    name: 'day2 touring + LLM 빈값 (A 한계 → "")',
    productDestination: 'Poland',
    rows: [
      {
        day: 2,
        title: d2.title,
        description: d2.description,
        imageKeyword: '',
        imageKeyword2: null,
      },
    ],
    detRows: [d2],
  },
  {
    name: 'free day + LLM Warsaw',
    productDestination: 'Poland',
    rows: [
      {
        day: 3,
        title: '바르샤바',
        description: '바르샤바 자유시간',
        imageKeyword: 'Warsaw',
        imageKeyword2: null,
      },
    ],
  },
  {
    name: 'India + LLM Paris (타대륙 차단)',
    productDestination: 'India',
    rows: [
      {
        day: 2,
        title: '델리',
        description: '타지마할',
        imageKeyword: 'Taj Mahal',
        imageKeyword2: 'Paris Eiffel Tower',
      },
    ],
  },
  {
    name: 'Poland + LLM Paris (B 영역 — 통과(미차단))',
    productDestination: 'Poland',
    rows: [
      {
        day: 2,
        title: '바르샤바',
        description: "'쇼팽 공원'",
        imageKeyword: 'Paris',
        imageKeyword2: null,
      },
    ],
    note: '통과(미차단) — same-continent 오류는 Plan A 블랙리스트 밖',
  },
]

for (const c of cases) {
  console.log(`\n=== ${c.name} ===`)
  if (c.note) console.log(`  note: ${c.note}`)
  const out = applyVerygoodScheduleImageKeywordsToRows(c.rows, {
    detRows: c.detRows,
    productDestination: c.productDestination,
    totalDays: c.rows.length,
  })
  for (const r of out) {
    console.log(`  day ${r.day}: kw1=${JSON.stringify(r.imageKeyword)} kw2=${JSON.stringify(r.imageKeyword2)}`)
    if (r.day === 1 && c.name.includes('day1')) {
      console.log(`    Seat Pitch blocked: ${r.imageKeyword !== 'Seat Pitch'}`)
    }
    auditKeyword('kw1', r.imageKeyword, c.productDestination)
    auditKeyword('kw2', r.imageKeyword2, c.productDestination)
    if (r.imageKeyword && r.imageKeyword2) {
      console.log(`    1≠2: ${r.imageKeyword !== r.imageKeyword2}`)
    }
  }
}
