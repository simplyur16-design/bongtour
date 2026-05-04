/**
 * 교원이지(kyowontour) — 본문 정규식·패턴 파싱 (LLM 없음, Phase 2-B).
 * 항공/가격/미팅/호텔/상품코드. 옵션·쇼핑은 본문 표 형식이 거의 없어 미구현.
 */
import type { KyowontourFlightFromBody, KyowontourMeetingInfo } from '@/lib/kyowontour/register-llm'

const SCAN_MAX = 500_000

/** 단위 테스트·스모크용 (가오슝+타이난 4일 스타일 스니펫) */
export const KYOWONTOUR_SITE_PARSER_SAMPLE_BODY = `
상품코드 CTP221260528TW01
3박4일 가오슝+타이난
성인 1,029,000원 / 아동 1,029,000원 / 유아 150,000원

[항공편]
티웨이항공 TW671 인천 08:30 → 가오슝 10:45
티웨이항공 TW672 가오슝 11:30 → 인천 15:00

미팅장소: 인천공항 1터미널 3층 G카운터 앞
미팅시간: 출발일 05:30

숙박: 시내 4성급 호텔 (동급)

1일차 가오슝 도착 후 시내관광
`

export type KyowontourParsedPrices = {
  adult: number | null
  child: number | null
  infant: number | null
}

function parseKoreanMoney(s: string): number | null {
  const digits = s.replace(/[^\d]/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

/**
 * 본문에서 성인/아동/유아 가격 (첫 매칭 우선).
 */
export function parseKyowontourPriceFromBody(body: string): KyowontourParsedPrices {
  const blob = body.slice(0, Math.min(body.length, SCAN_MAX))
  let adult: number | null = null
  let child: number | null = null
  let infant: number | null = null

  const adultM = blob.match(/성인\s*[:：]?\s*([\d,]+)\s*(?:원|만원)?/i)
  if (adultM) adult = parseKoreanMoney(adultM[1])

  const childM = blob.match(/아동\s*[:：]?\s*([\d,]+)\s*(?:원|만원)?/i)
  if (childM) child = parseKoreanMoney(childM[1])

  const infantM = blob.match(/유아\s*[:：]?\s*([\d,]+)\s*(?:원|만원)?/i)
  if (infantM) infant = parseKoreanMoney(infantM[1])

  return { adult, child, infant }
}

/**
 * 상품코드 (예: CTP221260528TW01). `tourCode=` URL 파라미터도 인식.
 */
export function parseKyowontourProductCodeFromBody(body: string): string | null {
  const blob = body.slice(0, Math.min(body.length, SCAN_MAX))
  const url = blob.match(/[?&]tourCode=([A-Z0-9]+)/i)
  if (url?.[1]) return url[1].toUpperCase()

  const m = blob.match(/\b([A-Z]{3}\d{9}[A-Z]{2}\d{2})\b/)
  if (m?.[1]) return m[1]

  const loose = blob.match(/\b([A-Z]{2,}\d{6,}[A-Z]?\d*)\b/)
  return loose?.[1] ?? null
}

function detectAirlineLabel(blob: string): string {
  if (/티웨이|Tway|TW\s*항공|tway/i.test(blob)) return '티웨이'
  if (/대한항공|KE\d{3,4}/i.test(blob)) return '대한항공'
  if (/아시아나|OZ\d{3,4}/i.test(blob)) return '아시아나'
  if (/진에어|LJ\d{3}/i.test(blob)) return '진에어'
  if (/에어부산|BX\d{3}/i.test(blob)) return '에어부산'
  return ''
}

function parseTimeHm(s: string): string {
  const m = s.match(/(\d{1,2})\s*[:：]\s*(\d{2})/)
  if (!m) return s.trim()
  const h = String(Number(m[1])).padStart(2, '0')
  return `${h}:${m[2]}`
}

type FlightHit = { flightNo: string; dep: string; arr: string; raw: string }

function timesOnSameLine(line: string): { dep: string; arr: string } {
  const depM = line.match(/(\d{1,2})\s*[:：]\s*(\d{2})/g)
  const times = depM ? depM.map(parseTimeHm) : []
  return { dep: times[0] ?? '', arr: times[1] ?? '' }
}

/**
 * 본문에서 항공편 번호·대략 시각 (같은 줄의 시각만 사용, 첫 두 편을 왕복으로 가정).
 */
export function parseKyowontourFlightFromBody(body: string): KyowontourFlightFromBody | null {
  const blob = body.slice(0, Math.min(body.length, SCAN_MAX))
  const airline = detectAirlineLabel(blob)
  const hits: FlightHit[] = []

  const lines = blob.split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/\b([A-Z]{2}\d{3,4})\b/i)
    if (!m) continue
    const flightNo = m[1].toUpperCase()
    const { dep, arr } = timesOnSameLine(line)
    hits.push({ flightNo, dep, arr, raw: line.replace(/\s+/g, ' ').trim() })
  }

  const uniq: FlightHit[] = []
  const seen = new Set<string>()
  for (const h of hits) {
    if (seen.has(h.flightNo)) continue
    seen.add(h.flightNo)
    uniq.push(h)
  }
  if (uniq.length < 2) return null

  const [o, i] = [uniq[0], uniq[1]]
  return {
    airline: airline || '항공',
    outbound: {
      flightNo: o.flightNo,
      departureDateTime: o.dep || '00:00',
      arrivalDateTime: o.arr || '',
    },
    inbound: {
      flightNo: i.flightNo,
      departureDateTime: i.dep || '00:00',
      arrivalDateTime: i.arr || '',
    },
  }
}

/**
 * 미팅 장소·시간 (라벨 행 우선).
 */
export function parseKyowontourMeetingInfoFromBody(body: string): KyowontourMeetingInfo | null {
  const blob = body.slice(0, Math.min(body.length, SCAN_MAX))
  const locM = blob.match(/미팅\s*장소\s*[:：]\s*([^\n\r]+)/i)
  const timeM = blob.match(/미팅\s*시간\s*[:：]\s*([^\n\r]+)/i)
  const location = locM?.[1]?.trim() ?? ''
  const time = timeM?.[1]?.trim() ?? ''
  if (!location && !time) return null
  return { location, time }
}

/**
 * 호텔 등급 문구 (시내 4성급, 5성급 호텔 등).
 */
export function parseKyowontourHotelFromBody(body: string): string | null {
  const blob = body.slice(0, Math.min(body.length, SCAN_MAX))
  const m =
    blob.match(/(?:숙박|호텔)\s*[:：]?\s*([^\n\r]{2,80})/i) ??
    blob.match(/시내\s*\d\s*성급[^\n\r]*/i) ??
    blob.match(/\d\s*성급(?:\s*호텔)?[^\n\r]{0,40}/i)
  const t = m?.[0]?.replace(/^[^:]+:\s*/i, '').trim()
  return t || null
}
