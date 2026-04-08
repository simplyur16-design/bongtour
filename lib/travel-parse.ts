import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import type { ParsedProductForDB, ParsedProductPrice, ParsedItinerary } from './parsed-product-types'

const TRAVEL_PARSE_PROMPT = `# Role: 전문 여행 데이터 파싱 엔진 (LLM)
# Task: 사장님이 복사해 넣은 여행사 텍스트를 분석하여 JSON으로 반환.

# [추출 규칙]
1. **출발일별 가격**: 모든 출발일의 가격을 찾아 prices 배열에 전부 넣어라.
2. **노베드·아동 요금 구분**: 아동(베드 포함)은 childBedBase/childFuel, 아동(노베드)은 childNoBedBase, 유아는 infantBase/infantFuel로 구분하여 추출하라.
3. **불포함·현지 지불**: '불포함', '현지 지불' 문구를 찾아 criticalExclusions에 반영하라.
4. **일차별 일정(itineraries) 필수**: 원문에 "1일차", "2일차", "Day1", "일정표", "스케줄" 등 일차별 일정이 있으면 **반드시 전부** 추출한다. 각 일차마다 { "day": 1, "description": "해당 일차의 이동·관광·식사 등 요약 또는 원문" } 형태로 넣고, 일차를 누락하거나 비우지 말 것. description에는 해당 일차의 핵심 일정 내용을 한 줄 이상 넣는다.

# [아동 노베드(childNoBedBase) 필수 규칙]
- childNoBedBase에는 **최종 기본가(원)** 하나만 저장.
- "200,000원 할인", "노베드 할인 20만" 등 할인액이 나오면 → adultBase - 할인액으로 계산.
- "아동 노베드 1,690,000원"처럼 최종가가 나오면 그 숫자 그대로 사용.

# [현지비·환율]
- 현지 지불 비용은 원화 환산 금지. 숫자(mandatoryLocalFee)와 단위(mandatoryCurrency, 예: USD)만 저장.

# [출발일별 항공·미팅 (선택, 모두투어 등 상세에 명시될 때만)]
- 각 prices[] 항목에 선택 필드로 넣을 수 있음: carrierName, outboundFlightNo, outboundDepartureAirport, outboundDepartureAt, outboundArrivalAirport, outboundArrivalAt, inboundFlightNo, inboundDepartureAirport, inboundDepartureAt, inboundArrivalAirport, inboundArrivalAt, meetingInfoRaw, meetingPointRaw, meetingTerminalRaw, meetingGuideNoticeRaw. 시각은 ISO8601 또는 "2026-04-01 16:05" 형식. 불명확하면 생략.

# [criticalExclusions]
- 고객이 놓치기 쉬운 핵심만 한 줄 요약. 예: "가이드비 $30, 유류세 변동 가능"

응답은 반드시 아래 JSON만 출력. 다른 설명·마크다운 없이 JSON만.

{
  "originCode": "string",
  "title": "string",
  "destination": "string",
  "duration": "string",
  "airline": "string or null",
  "isFuelIncluded": true,
  "isGuideFeeIncluded": false,
  "mandatoryLocalFee": 30,
  "mandatoryCurrency": "USD",
  "includedText": "포함 내역 전체 텍스트",
  "excludedText": "불포함 내역 전체 텍스트",
  "criticalExclusions": "가이드비 $30, 유류세 변동 가능",
  "prices": [ ... ],
  "itineraries": [
    { "day": 1, "description": "1일차 일정 요약 (출발, 이동, 첫 관광지 등)" },
    { "day": 2, "description": "2일차 일정 요약" }
  ]
}
itineraries: 원문의 일차별 일정을 빠짐없이 추출. day는 숫자(1,2,3...), description은 해당 일차의 핵심 일정 텍스트.` as const

export type TravelParseRaw = {
  originCode?: string
  title?: string
  destination?: string
  destinationRaw?: string | null
  primaryDestination?: string | null
  supplierGroupId?: string | null
  priceFrom?: number | null
  priceCurrency?: string | null
  duration?: string
  airline?: string | null
  isFuelIncluded?: boolean
  isGuideFeeIncluded?: boolean
  mandatoryLocalFee?: number | null
  mandatoryCurrency?: string | null
  includedText?: string | null
  excludedText?: string | null
  criticalExclusions?: string | null
  prices?: ParsedProductPrice[]
  itineraries?: ParsedItinerary[]
}

export async function extractTravelProductForDB(
  rawText: string,
  originSource: string = '직접입력'
): Promise<ParsedProductForDB> {
  const model = getGenAI().getGenerativeModel({ model: getModelName() })
  const prompt = `
${TRAVEL_PARSE_PROMPT}

# Input (원본 텍스트):
${rawText.slice(0, 60000)}
`.trim()

  const result = await model.generateContent(prompt, geminiTimeoutOpts())
  const text = result.response.text()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('LLM이 유효한 JSON을 반환하지 않았습니다.')
  const raw = JSON.parse(jsonMatch[0]) as TravelParseRaw

  const prices: ParsedProductPrice[] = (raw.prices ?? []).map((p) => {
    const base: ParsedProductPrice = {
      date: String(p?.date ?? '').slice(0, 10),
      adultBase: Number(p?.adultBase) || 0,
      adultFuel: Number(p?.adultFuel) || 0,
      childBedBase: p?.childBedBase != null ? Number(p.childBedBase) : undefined,
      childNoBedBase: p?.childNoBedBase != null ? Number(p.childNoBedBase) : undefined,
      childFuel: Number(p?.childFuel) || 0,
      infantBase: p?.infantBase != null ? Number(p.infantBase) : undefined,
      infantFuel: Number(p?.infantFuel) || 0,
      status:
        p?.status === '출발확정' ||
        p?.status === '예약가능' ||
        p?.status === '마감' ||
        p?.status === '대기예약'
          ? p.status
          : '예약가능',
      availableSeats: Number(p?.availableSeats) || 0,
    }
    const ext = p as Record<string, unknown>
    const s = (k: string) => {
      const v = ext[k]
      return v != null && String(v).trim() ? String(v).trim() : undefined
    }
    return {
      ...base,
      carrierName: s('carrierName'),
      outboundFlightNo: s('outboundFlightNo'),
      outboundDepartureAirport: s('outboundDepartureAirport'),
      outboundDepartureAt: s('outboundDepartureAt') ?? null,
      outboundArrivalAirport: s('outboundArrivalAirport'),
      outboundArrivalAt: s('outboundArrivalAt') ?? null,
      inboundFlightNo: s('inboundFlightNo'),
      inboundDepartureAirport: s('inboundDepartureAirport'),
      inboundDepartureAt: s('inboundDepartureAt') ?? null,
      inboundArrivalAirport: s('inboundArrivalAirport'),
      inboundArrivalAt: s('inboundArrivalAt') ?? null,
      meetingInfoRaw: s('meetingInfoRaw') ?? null,
      meetingPointRaw: s('meetingPointRaw') ?? null,
      meetingTerminalRaw: s('meetingTerminalRaw') ?? null,
      meetingGuideNoticeRaw: s('meetingGuideNoticeRaw') ?? null,
    }
  })

  const itineraries: ParsedItinerary[] = (raw.itineraries ?? []).map((i) => ({
    day: Number(i?.day) || 0,
    description: String(i?.description ?? '').trim(),
  }))

  const dest = (raw.destination ?? '').trim() || '미지정'
  const destRaw = (raw.destinationRaw ?? raw.destination ?? '').trim() || null
  const primaryDest = (raw.primaryDestination ?? raw.destination ?? '').trim() || null
  const firstPrice = prices[0]
  const priceFrom =
    raw.priceFrom != null
      ? Number(raw.priceFrom)
      : firstPrice
        ? (firstPrice.adultBase ?? 0) + (firstPrice.adultFuel ?? 0)
        : null
  const priceCurrency = (raw.priceCurrency as string)?.trim() || (priceFrom != null ? 'KRW' : null)

  return {
    originSource,
    originCode: (raw.originCode ?? '').trim() || '미지정',
    title: (raw.title ?? '').trim() || '상품명 없음',
    destination: dest,
    destinationRaw: destRaw || dest || null,
    primaryDestination: primaryDest || dest || null,
    supplierGroupId: (raw.supplierGroupId as string)?.trim() || null,
    priceFrom: priceFrom != null && !isNaN(priceFrom) ? priceFrom : null,
    priceCurrency,
    duration: (raw.duration ?? '').trim() || '미지정',
    airline: (raw.airline as string)?.trim() || undefined,
    isFuelIncluded: raw.isFuelIncluded !== false,
    isGuideFeeIncluded: raw.isGuideFeeIncluded === true,
    mandatoryLocalFee: raw.mandatoryLocalFee != null ? Number(raw.mandatoryLocalFee) : null,
    mandatoryCurrency: (raw.mandatoryCurrency as string)?.trim() || null,
    includedText: (raw.includedText as string)?.trim() || null,
    excludedText: (raw.excludedText as string)?.trim() || null,
    counselingNotes: null,
    criticalExclusions: (raw.criticalExclusions as string)?.trim() || null,
    prices,
    surcharges: [],
    itineraries,
  }
}
