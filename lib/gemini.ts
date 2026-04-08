import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import {
  EXTRACTION_JSON_SCHEMA_B2B,
  EXTRACTION_JSON_SCHEMA_PRICING,
  type ExtractedProduct,
  type ExtractedB2B,
  type ExtractedB2BOptionalTour,
  type ExtractedPricingSchedule,
} from './extraction-schema'
import { B2B_EXTRACT_TONE_ADDENDUM } from './bongtour-tone-manner-llm-ssot'

const B2B_SYSTEM_PROMPT = `# Role
너는 20년 경력의 베테랑 B2B 여행사 관리자다. 너의 임무는 지저분한 여행사 상세페이지 텍스트에서 '돈'과 '팩트'만 발라내어 정밀한 JSON 데이터를 생성하는 것이다.

${B2B_EXTRACT_TONE_ADDENDUM}

# Goal
1. 광고성 문구(최고의 휴양, 특전 등)는 철저히 배제한다.
2. 고객과 분쟁 소지가 있는 '불포함 사항', '현지 지불금', '쇼핑 횟수'를 최우선으로 추출한다.
3. 상품 코드를 분석해 브랜드를 자동 식별한다.`

export async function extractProductFromText(rawText: string): Promise<ExtractedProduct> {
  const model = getGenAI().getGenerativeModel({ model: getModelName() })
  const prompt = `
${B2B_SYSTEM_PROMPT}

${EXTRACTION_JSON_SCHEMA_B2B}

[원문]
${rawText.slice(0, 60000)}
`.trim()

  const result = await model.generateContent(prompt, geminiTimeoutOpts())
  const response = result.response
  const text = response.text()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI did not return valid JSON')
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
  const b2b = parsed as unknown as ExtractedB2B

  return mapB2BToExtractedProduct(b2b)
}

/**
 * 하나투어/모두투어 상세 텍스트에서 연령별 가격·날짜별 좌석·현지비 추출.
 * 실시간 가격 연동·예약 계산기용. 수치 오류 없이 표준 판매가만 추출.
 */
export async function extractPricingScheduleFromText(
  rawText: string
): Promise<ExtractedPricingSchedule> {
  const model = getGenAI().getGenerativeModel({ model: getModelName() })
  const prompt = `
${EXTRACTION_JSON_SCHEMA_PRICING}

# Input Data:
${rawText.slice(0, 60000)}
`.trim()

  const result = await model.generateContent(prompt, geminiTimeoutOpts())
  const response = result.response
  const text = response.text()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI did not return valid JSON for pricing schedule')
  const parsed = JSON.parse(jsonMatch[0]) as ExtractedPricingSchedule
  return normalizePricingSchedule(parsed)
}

function normalizePricingSchedule(raw: ExtractedPricingSchedule): ExtractedPricingSchedule {
  const product_code = (raw.product_code as string)?.trim() || ''
  const daily_schedule = Array.isArray(raw.daily_schedule) ? raw.daily_schedule : []
  return {
    product_code,
    daily_schedule: daily_schedule.map((row) => ({
      date: String(row?.date ?? '').slice(0, 10),
      status:
        row?.status === '출발확정' ||
        row?.status === '예약가능' ||
        row?.status === '대기예약' ||
        row?.status === '마감'
          ? row.status
          : '예약가능',
      seats: row?.seats != null ? Number(row.seats) : undefined,
      pricing: row?.pricing ?? { adult: { base: 0, fuel: 0, total: 0 } },
      modifiers: Array.isArray(row?.modifiers) ? row.modifiers : undefined,
      single_room_extra: row?.single_room_extra != null ? Number(row.single_room_extra) : undefined,
      local_guide_fee: (row?.local_guide_fee as string)?.trim() || undefined,
    })),
  }
}

/** B2B 추출 결과 → 기존 ExtractedProduct/DB 형식으로 매핑 */
function mapB2BToExtractedProduct(b2b: ExtractedB2B): ExtractedProduct {
  const brand = b2b.brand ?? {}
  const priceInfo = b2b.priceInfo ?? { adult: 0, child: 0, currency: 'KRW' }
  const onSite = b2b.onSiteBudget ?? {
    mandatoryGuideFee: { amount: 0, currency: 'USD' },
    shoppingCount: 0,
    shoppingItems: [],
    optionalTours: [],
  }
  const guideFee = onSite.mandatoryGuideFee?.amount ?? 0
  const shoppingItemsArr = Array.isArray(onSite.shoppingItems) ? onSite.shoppingItems : []
  const shoppingItemsStr = shoppingItemsArr.filter(Boolean).join(', ') || undefined

  const optionalTours = (onSite.optionalTours ?? []).map((o: ExtractedB2BOptionalTour) => ({
    name: o.name ?? '',
    priceUsd: Number(o.price) || 0,
    waitPlaceIfNotJoined: o.isWaiting ? '대기' : undefined,
  }))

  const routeSummary = Array.isArray(b2b.routeSummary) ? b2b.routeSummary : []
  const itinerary = routeSummary.map((line, i) => {
    const match = line.match(/^(\d+)일차\s*[:\-]?\s*(.*)$/)
    const day = match ? parseInt(match[1], 10) : i + 1
    const rest = (match ? match[2] : line).trim()
    return { day, title: rest.slice(0, 100), items: rest ? [rest] : [] }
  })

  const productName =
    (b2b.productName as string)?.trim() ||
    (priceInfo.adult ? `성인 ${priceInfo.currency} ${priceInfo.adult.toLocaleString()}` : '상품명 없음')

  const dailyPrices =
    priceInfo.adult > 0
      ? [{ date: '', price: `성인 ${priceInfo.adult.toLocaleString()} ${priceInfo.currency}` }]
      : []

  return {
    productName,
    productTitle: (b2b.productName as string)?.trim() || productName,
    airline: (b2b.airline as string)?.trim() || '',
    productCode: (brand.productCode as string)?.trim() || '',
    groupNumber: (b2b.groupNumber as string)?.trim() || '',
    brandName: (brand.detected as string)?.trim() || undefined,
    primaryDestination: (b2b.primaryDestination as string)?.trim() || undefined,
    dailyPrices,
    priceList: undefined,
    shoppingCount: Number(onSite.shoppingCount) || 0,
    shoppingItems: shoppingItemsStr,
    guideFeeNote:
      guideFee > 0 ? `가이드 경비 약 $${guideFee} (현지 불포함)` : (b2b.legalDisclaimer as string) || undefined,
    guideFeeUsd: guideFee > 0 ? guideFee : undefined,
    optionalTours,
    itinerary,
    factCheck: {
      shoppingCount: Number(onSite.shoppingCount) || 0,
      shoppingItems: shoppingItemsStr,
      guideFeeUsd: guideFee > 0 ? guideFee : undefined,
      optionalTours,
    },
  }
}
