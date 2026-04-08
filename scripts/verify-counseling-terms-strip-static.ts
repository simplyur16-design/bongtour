/**
 * scripts/.tmp-paste-verify/*-para.txt 에서
 * (1) 약관성 키워드가 있는 줄 → stripCounselingTermsFromScheduleText 후 잔존 여부
 * (2) 항공·일정형 줄(약관 패턴 없음) → strip 후에도 항공 신호 유지
 *
 * LLM 없음 — strip 모듈 실측 전용. 실행: npx tsx scripts/verify-counseling-terms-strip-static.ts
 */
import fs from 'fs'
import path from 'path'
import {
  stripCounselingTermsFromItineraryDayDraft,
  stripCounselingTermsFromScheduleRow,
  stripCounselingTermsFromScheduleText,
} from '../lib/itinerary-counseling-terms-strip'

const PARA_DIR = path.join(process.cwd(), 'scripts', '.tmp-paste-verify')

const FORBIDDEN: Array<{ id: string; re: RegExp }> = [
  { id: '표준약관', re: /국외\s*여행\s*표준약관|국내\s*여행\s*표준약관|여행\s*표준약관/ },
  { id: '특별약관', re: /특별약관/ },
  { id: '취소수수료_헤더', re: /약관\s*\/\s*취소수수료|■\s*취소수수료|취소수수료\s*규정/ },
  { id: '예약금_규정', re: /■\s*예약금|예약금\s*규정|예약금\s*전액/ },
  { id: '계약금_환불', re: /계약금\s*환불|계약금\s*규정/ },
  { id: '환불규정', re: /환불규정|취소환불규정/ },
  { id: '취소료규정', re: /취소료\s*규정/ },
  { id: '예약후24시간', re: /예약\s*후\s*\d{1,2}\s*시간\s*내/ },
  { id: '여행요금_배상', re: /여행요금의\s*\d+\s*%|배상하여야\s*합니다/ },
  { id: '발권후_패널티', re: /발권\s*후\s*취소\s*패널티|항공권\s*발권\s*이후.*패널티/ },
  { id: '국외여행표준약관_조문', re: /표준약관\s*제\s*\d+\s*조/ },
  { id: '예약과취소_표준약관', re: /예약과\s*취소는.*표준약관/ },
]

const FLIGHT_SIGNAL = /항공|공항|편명|출발|도착|ICN|GMP|[A-Z]{2}\s*\d{3,4}/

function findForbidden(haystack: string): Array<{ id: string; sample: string }> {
  const found: Array<{ id: string; sample: string }> = []
  for (const { id, re } of FORBIDDEN) {
    re.lastIndex = 0
    const m = haystack.match(re)
    if (m) found.push({ id, sample: m[0].slice(0, 120) })
  }
  return found
}

function linesFromFile(p: string): string[] {
  return fs.readFileSync(p, 'utf8').split(/\r?\n/)
}

function main() {
  const jobs: Array<{ supplier: string; file: string; flightSampleLine: number }> = [
    { supplier: 'hanatour', file: 'hanatour-para.txt', flightSampleLine: 159 },
    { supplier: 'modetour', file: 'modetour-para.txt', flightSampleLine: 153 },
    { supplier: 'verygoodtour', file: 'verygoodtour-para.txt', flightSampleLine: 49 },
    { supplier: 'ybtour', file: 'ybtour-para.txt', flightSampleLine: 303 },
  ]

  let exitCode = 0
  const report: unknown[] = []

  for (const j of jobs) {
    const fp = path.join(PARA_DIR, j.file)
    if (!fs.existsSync(fp)) {
      console.error('MISSING', fp)
      exitCode = 1
      continue
    }
    const lines = linesFromFile(fp)
    const risky: Array<{ lineNo: number; raw: string; afterHits: ReturnType<typeof findForbidden> }> = []
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i] ?? ''
      if (!raw.trim()) continue
      const before = findForbidden(raw)
      if (before.length === 0) continue
      const stripped = stripCounselingTermsFromScheduleText(raw)
      const afterHits = findForbidden(stripped)
      if (afterHits.length > 0) {
        risky.push({ lineNo: i + 1, raw: raw.slice(0, 200), afterHits })
      }
    }

    const flightLine = lines[j.flightSampleLine - 1] ?? ''
    const flightBefore = findForbidden(flightLine)
    const flightStripped = stripCounselingTermsFromScheduleText(flightLine)
    const flightOk =
      flightBefore.length === 0 &&
      FLIGHT_SIGNAL.test(flightLine) &&
      FLIGHT_SIGNAL.test(flightStripped)

    const rowTest = stripCounselingTermsFromScheduleRow({
      day: 1,
      title: '테스트일차',
      description: lines.find((l) => findForbidden(l).length > 0) ?? '■ 약관',
      imageKeyword: 'x',
    })
    const rowExposed = `${rowTest.title}\n${rowTest.description}`
    const rowForbiddenAfter = findForbidden(rowExposed)

    const draftTest = stripCounselingTermsFromItineraryDayDraft({
      day: 1,
      summaryTextRaw: '■ 취소수수료 규정\n인천 출발',
      rawBlock: JSON.stringify({
        title: 'Day1',
        description: '국외여행 표준약관 제16조에 따라 취소료',
        imageKeyword: 'k',
      }),
      hotelText: '호텔',
      breakfastText: '조식',
      lunchText: '중식',
      dinnerText: '석식',
      mealSummaryText: '조/중/석',
    })
    const draftBlob = [
      draftTest.summaryTextRaw,
      draftTest.rawBlock,
      draftTest.breakfastText,
    ].join('\n')
    const draftForbidden = findForbidden(draftBlob)

    const ok = risky.length === 0 && flightOk && rowForbiddenAfter.length === 0 && draftForbidden.length === 0
    if (!ok) exitCode = 1

    const block = {
      supplier: j.supplier,
      file: j.file,
      riskyLinesAfterStrip: risky.slice(0, 15),
      riskyCount: risky.length,
      flightSample: { lineNo: j.flightSampleLine, preservedFlightSignal: flightOk, flightStripped: flightStripped.slice(0, 120) },
      scheduleRowSynthetic: { rowForbiddenAfter: rowForbiddenAfter.map((x) => x.id) },
      draftSynthetic: { draftForbiddenAfter: draftForbidden.map((x) => x.id) },
      pass: ok,
    }
    report.push(block)
    console.log('\n===', j.supplier, '===')
    console.log(JSON.stringify(block, null, 2))
  }

  const vg48 =
    linesFromFile(path.join(PARA_DIR, 'verygoodtour-para.txt'))[47] ?? ''
  const vg48Stripped = stripCounselingTermsFromScheduleText(vg48)
  const vg48Bad = findForbidden(vg48Stripped)
  if (vg48Bad.length) {
    console.error('verygood line 48 (표준약관 제12조 장문) still matches:', vg48Bad)
    exitCode = 1
  } else {
    console.log('\nverygood line48 strip: OK (표준약관 제12조 구간 제거)')
  }

  console.log('\n=== STATIC AGGREGATE pass:', report.every((r: any) => r.pass) && vg48Bad.length === 0)
  process.exit(exitCode)
}

main()
