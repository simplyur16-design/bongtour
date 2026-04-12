import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getGenAI,
  getModelName,
  testGeminiConnection,
  isConnectionResolved,
  geminiTimeoutOpts,
} from '@/lib/gemini-client'
import { normalizeCalendarDate } from '@/lib/date-normalize'
import { extractDestinationFromTitle } from '@/lib/destination-from-title'
import { extractRelevantSections } from '@/lib/paste-relevant-sections'
import { upsertProductDepartures } from '@/lib/upsert-product-departures-hanatour'
import { upsertItineraryDays, registerScheduleToDayInputs } from '@/lib/upsert-itinerary-days-hanatour'
import { normalizeOriginSource } from '@/lib/supplier-origin'
import { buildParseSupplierInputDebug, normalizeParseRequestOriginSource } from '@/lib/parse-api-origin-source'
import { getAdminServiceBearerSecret } from '@/lib/admin-secrets'
import { requireAdmin } from '@/lib/require-admin'
// [일정 정책] Product.schedule = 렌더용; ItineraryDay = 원문 정본. 이 경로는 레거시 Itinerary 미사용(허용).

/** 분석 속도 개선: 26k자로 제한 (약 7k 토큰). 긴 붙여넣기는 앞부분만 사용 */
const TEXT_LIMIT = 26000

/** 팩트만 추출 */
type ParsedPayload = {
  originSource?: string
  originCode?: string
  title?: string
  destination?: string
  duration?: string
  airline?: string
  mainKeyword?: string
  productType?: string
  hotelInfo?: {
    hotelName?: string
    hotelGrade?: string
    stayNights?: string
    roomType?: string
    breakfastIncluded?: string
    hotelArea?: string
    hotelSummary?: string
    hotelImageUrl?: string
    hotelDetailUrl?: string
  }
  prices?: Array<{
    date?: string
    adult?: number
    childBed?: number
    childNoBed?: number
    infant?: number
    localPrice?: string
    adultBase?: number
    adultFuel?: number
    carrierName?: string
    outboundFlightNo?: string
    outboundDepartureAirport?: string
    outboundDepartureAt?: string
    outboundArrivalAirport?: string
    outboundArrivalAt?: string
    inboundFlightNo?: string
    inboundDepartureAirport?: string
    inboundDepartureAt?: string
    inboundArrivalAirport?: string
    inboundArrivalAt?: string
    meetingInfoRaw?: string
    meetingPointRaw?: string
    meetingTerminalRaw?: string
    meetingGuideNoticeRaw?: string
  }>
  schedule?: Array<{ day?: number; title?: string; description?: string; content?: string }>
  keywords?: Array<{ day?: number; keyword?: string }>
}

const PARSE_STEP = '[Bong투어-DEBUG] [Bong투어/parse]'
/** `POST /api/travel/parse?debugSupplier=1` → 성공 시 `supplierInputDebug`(body `originSource` raw, coerce, effective). */

/** 본문 2차 키: ADMIN_SERVICE_BEARER_SECRET (구 ADMIN_BYPASS_SECRET 폴백). */
function resolveParseRouteBodyAuthSecret(): string {
  return getAdminServiceBearerSecret()
}

function inferAirportTransferType(rawText: string): 'NONE' | 'PICKUP' | 'SENDING' | 'BOTH' {
  const t = rawText.toLowerCase()
  const hasPickup = /(공항\s*픽업|픽업\s*포함|pickup)/i.test(t)
  const hasSending = /(공항\s*샌딩|샌딩\s*포함|sending|drop\s*off|dropoff)/i.test(t)
  if (hasPickup && hasSending) return 'BOTH'
  if (hasPickup) return 'PICKUP'
  if (hasSending) return 'SENDING'
  return 'NONE'
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  const AUTH_SECRET = resolveParseRouteBodyAuthSecret()
  if (!AUTH_SECRET) {
    return NextResponse.json(
      { error: '서버에 ADMIN_SERVICE_BEARER_SECRET(또는 구 ADMIN_BYPASS_SECRET)이 설정되지 않아 이 엔드포인트의 2차 인증을 사용할 수 없습니다.' },
      { status: 503 }
    )
  }
  try {
    console.log(`${PARSE_STEP} 1. 텍스트 수신`)
    const debugSupplier = new URL(req.url).searchParams.get('debugSupplier') === '1'
    const body = await req.json()
    const auth = body?.auth
    if (auth !== AUTH_SECRET) {
      console.log(`${PARSE_STEP} 1. 인증 실패 (body.auth 불일치)`)
      return NextResponse.json({ error: '인증이 필요합니다. (body.auth)' }, { status: 401 })
    }
    console.log(`${PARSE_STEP} 1. 인증 체크 통과`)
    const rawText = typeof body.rawText === 'string' ? body.rawText.trim() : (body.text as string)?.trim?.()
    const clientOriginSourceRaw = typeof body.originSource === 'string' ? body.originSource.trim() : null
    const brandKeyForOrigin =
      typeof body.brandKey === 'string' ? body.brandKey.trim() || null : null
    const clientOriginSource = clientOriginSourceRaw
      ? normalizeParseRequestOriginSource(clientOriginSourceRaw, brandKeyForOrigin)
      : null
    if (!rawText) {
      return NextResponse.json({ error: 'rawText 또는 text는 필수입니다.' }, { status: 400 })
    }
    console.log(`${PARSE_STEP} 텍스트 길이: ${rawText.length}자`)

    const textInput = extractRelevantSections(rawText, TEXT_LIMIT)
    if (rawText.length > textInput.length) {
      console.log(`${PARSE_STEP} 추출 구간만 사용: ${rawText.length}자 → ${textInput.length}자`)
    }

    if (!isConnectionResolved()) {
      console.log(`${PARSE_STEP} 2. 제미나이 연결 테스트`)
      const connectionTest = await testGeminiConnection()
      if (!connectionTest.ok) {
        const errMsg = `제미나이 연결 실패: 모델명을 확인하세요. (${connectionTest.error ?? 'unknown'})`
        console.error(`${PARSE_STEP} ${errMsg}`)
        return NextResponse.json({ error: errMsg }, { status: 503 })
      }
    } else {
      console.log(`${PARSE_STEP} 2. 연결 이미 확정, 테스트 생략`)
    }

    console.log(`${PARSE_STEP} 3. AI 호출 (모델: ${getModelName()}, 입력 ${textInput.length}자)`)
    const model = getGenAI().getGenerativeModel({ model: getModelName() })
    const prompt = `
다음은 여행사 상품 텍스트(및 달력 로그)이다. 오직 팩트만 추출하라. 주관적 분류·해석·요약은 하지 말 것.

# [달력 데이터 정밀 추출]
- 패턴 인식: [날짜/요일/가격/상태]가 반복되는 구간을 '달력 그리드'로 인식하라.
- 날짜 정규화: '26.04.17(금)', '26-04-17' 등은 반드시 '2026-04-17' 표준 포맷(YYYY-MM-DD)으로 변환하라.
- 가격 매핑: 성인 가격(adult)을 숫자로 추출하고, 해당 날짜의 예약 상태(status)를 1:1로 매핑하여 prices 배열을 생성하라.
- 주관 배제: 텍스트에 없는 날짜를 생성하지 말고, 오직 로그에 존재하는 데이터만 팩트대로 추출하라.

1. 'originSource': 여행사명, 'originCode': 상품코드, 'title': 상품명을 반드시 추출.
2. 'destination': 여행지(예: 타이베이, 다낭). 누락 시 title에서 도시명을 추출하여 채울 것.
3. 'duration', 'airline'(없으면 null).
4. 'mainKeyword': 상품 전체 대표 영문 키워드 1개 (예: Danang Beach, Osaka Castle).
5. 'prices': 달력에 등장하는 날짜만. date(YYYY-MM-DD), adult(원화 숫자), childBed, childNoBed, infant(없으면 0), localPrice(현지 지불 또는 null). 텍스트에 출발일별 항공·미팅이 명확히 있으면 선택 필드 추가: carrierName, outboundFlightNo, outboundDepartureAirport, outboundDepartureAt, outboundArrivalAirport, outboundArrivalAt, inboundFlightNo, inboundDepartureAirport, inboundDepartureAt, inboundArrivalAirport, inboundArrivalAt, meetingInfoRaw, meetingPointRaw, meetingTerminalRaw, meetingGuideNoticeRaw.
6. 'schedule': 일차별 day, title, description.
7. 'keywords': 일차별 영문 장소 키워드 1개씩. day(숫자), keyword(영문 문자열).

응답은 반드시 JSON만 출력. 다른 설명 없이.

텍스트:
${textInput}
`.trim()

    const result = await model.generateContent(
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      },
      geminiTimeoutOpts()
    )
    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error(`${PARSE_STEP} LLM이 JSON을 반환하지 않음`)
      return NextResponse.json({ error: 'LLM이 유효한 JSON을 반환하지 않았습니다.' }, { status: 500 })
    }
    const data = JSON.parse(jsonMatch[0]) as ParsedPayload
    console.log(`${PARSE_STEP} 3. AI 분석 완료. originCode: ${(data.originCode ?? '').trim() || '(없음)'}`)

    const originCode = (data.originCode ?? '').trim() || null
    const fromLlmOrigin = (data.originSource ?? '').trim() || '직접입력'
    const mergedForCoerce = clientOriginSource ?? fromLlmOrigin
    const originSourceCoerced = normalizeParseRequestOriginSource(mergedForCoerce, brandKeyForOrigin)
    const originSource = normalizeOriginSource(originSourceCoerced, brandKeyForOrigin)
    const title = (data.title ?? '').trim() || '상품명 없음'
    const destinationRaw = (data.destination ?? '').trim()
    const finalDestination = destinationRaw || extractDestinationFromTitle(title)
    if (!finalDestination || finalDestination === '미지정') {
      return NextResponse.json(
        { error: 'destination을 추출할 수 없습니다. title에 여행지명이 포함되어 있는지 확인하세요.' },
        { status: 400 }
      )
    }
    const destination = finalDestination
    const duration = (data.duration ?? '').trim() || '미지정'
    const airline = (data.airline ?? '').trim() || null
    if (!originCode) {
      return NextResponse.json({ error: '상품코드(originCode)를 추출할 수 없습니다.' }, { status: 400 })
    }

    const scheduleRaw = Array.isArray(data.schedule) ? data.schedule : []
    const keywordsMap = new Map<number, string>()
    if (Array.isArray(data.keywords)) {
      data.keywords.forEach((k) => {
        if (k?.day != null && k?.keyword) keywordsMap.set(Number(k.day), String(k.keyword).trim())
      })
    }

    // 이미지는 별도 API(process-images)에서 처리. 제미나이 분석만 빠르게 반영.
    const scheduleWithImages = scheduleRaw.map((s) => {
      const day = Number(s?.day) ?? 0
      const keyword = keywordsMap.get(day)?.trim() || `day ${s?.day ?? 0} travel`
      return {
        day,
        title: String(s?.title ?? '').trim(),
        description: String((s?.description ?? s?.content) ?? '').trim(),
        imageKeyword: keyword,
        imageUrl: null as string | null,
      }
    })
    const scheduleJson = JSON.stringify(scheduleWithImages)

    const effectiveOriginSource = originSource.trim() || '직접입력'
    const primaryDest = destinationRaw || destination
    const firstPrice = Array.isArray(data.prices) && data.prices[0]
    let priceFrom: number | null = null
    if (firstPrice) {
      const a = Number(firstPrice.adult)
      if (!isNaN(a) && a > 0) priceFrom = a
      else {
        const base = (Number(firstPrice.adultBase) || 0) + (Number((firstPrice as { adultFuel?: number }).adultFuel) || 0)
        if (base > 0) priceFrom = base
      }
    }
    const product = await prisma.product.upsert({
      where: {
        originSource_originCode: {
          originSource: effectiveOriginSource,
          originCode,
        },
      },
      update: {
        originSource: effectiveOriginSource,
        title,
        destination,
        destinationRaw: destinationRaw || null,
        primaryDestination: primaryDest || null,
        supplierGroupId: null, // TODO: parse API 클라이언트에서 전달 시 채우기
        productType: (data.productType as string)?.trim?.() || 'travel',
        airtelHotelInfoJson: data.hotelInfo ? JSON.stringify(data.hotelInfo) : null,
        airportTransferType: inferAirportTransferType(rawText),
        priceFrom,
        priceCurrency: priceFrom != null ? 'KRW' : null,
        duration,
        airline,
        bgImageUrl: null,
        counselingNotes: null,
        schedule: scheduleJson,
      },
      create: {
        originSource: effectiveOriginSource,
        originCode,
        title,
        destination,
        destinationRaw: destinationRaw || null,
        primaryDestination: primaryDest || null,
        supplierGroupId: null,
        productType: (data.productType as string)?.trim?.() || 'travel',
        airtelHotelInfoJson: data.hotelInfo ? JSON.stringify(data.hotelInfo) : null,
        airportTransferType: inferAirportTransferType(rawText),
        priceFrom,
        priceCurrency: priceFrom != null ? 'KRW' : null,
        duration,
        airline,
        bgImageUrl: null,
        counselingNotes: null,
        schedule: scheduleJson,
      },
    })

    const prices = Array.isArray(data.prices) ? data.prices : []
    const normalizedDates = prices.map((p) => {
      const raw = String(p?.date ?? '').trim()
      return normalizeCalendarDate(raw) || raw.slice(0, 10)
    })
    console.log(`[STEP 1] 달력 로그 파싱 완료 (${prices.length}건의 날짜 확보)`)

    await prisma.productPrice.deleteMany({ where: { productId: product.id } })
    const sortedPrices = prices
      .map((p, i) => {
        const dateStr = normalizedDates[i] ?? String(p?.date ?? '').slice(0, 10)
        if (!dateStr || dateStr.length < 10) return null
        const adult = Number(p?.adult) ?? (Number(p?.adultBase) ?? 0) + (Number(p?.adultFuel) ?? 0)
        const childBed = Number(p?.childBed) ?? 0
        const childNoBed = Number(p?.childNoBed) ?? 0
        const infant = Number(p?.infant) ?? 0
        return {
          date: new Date(dateStr),
          adult,
          childBed,
          childNoBed,
          infant,
          localPrice: p?.localPrice ? String(p.localPrice).trim() : null,
          carrierName: p?.carrierName,
          outboundFlightNo: p?.outboundFlightNo,
          outboundDepartureAirport: p?.outboundDepartureAirport,
          outboundDepartureAt: p?.outboundDepartureAt,
          outboundArrivalAirport: p?.outboundArrivalAirport,
          outboundArrivalAt: p?.outboundArrivalAt,
          inboundFlightNo: p?.inboundFlightNo,
          inboundDepartureAirport: p?.inboundDepartureAirport,
          inboundDepartureAt: p?.inboundDepartureAt,
          inboundArrivalAirport: p?.inboundArrivalAirport,
          inboundArrivalAt: p?.inboundArrivalAt,
          meetingInfoRaw: p?.meetingInfoRaw,
          meetingPointRaw: p?.meetingPointRaw,
          meetingTerminalRaw: p?.meetingTerminalRaw,
          meetingGuideNoticeRaw: p?.meetingGuideNoticeRaw,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    let prevTotal = 0
    const priceRows = sortedPrices.map((row) => {
      const total = row.adult + row.childBed + row.childNoBed + row.infant
      const priceGap = prevTotal > 0 ? total - prevTotal : 0
      prevTotal = total
      return {
        productId: product.id,
        date: row.date,
        adult: row.adult,
        childBed: row.childBed,
        childNoBed: row.childNoBed,
        infant: row.infant,
        localPrice: row.localPrice,
        priceGap,
      }
    })
    if (priceRows.length > 0) {
      await prisma.productPrice.createMany({ data: priceRows })
      const departureInputs = sortedPrices.map((row) => ({
        departureDate: row.date,
        adultPrice: row.adult || undefined,
        childBedPrice: row.childBed || undefined,
        childNoBedPrice: row.childNoBed || undefined,
        infantPrice: row.infant || undefined,
        localPriceText: row.localPrice ?? undefined,
        carrierName: row.carrierName ?? undefined,
        outboundFlightNo: row.outboundFlightNo ?? undefined,
        outboundDepartureAirport: row.outboundDepartureAirport ?? undefined,
        outboundDepartureAt: row.outboundDepartureAt ?? undefined,
        outboundArrivalAirport: row.outboundArrivalAirport ?? undefined,
        outboundArrivalAt: row.outboundArrivalAt ?? undefined,
        inboundFlightNo: row.inboundFlightNo ?? undefined,
        inboundDepartureAirport: row.inboundDepartureAirport ?? undefined,
        inboundDepartureAt: row.inboundDepartureAt ?? undefined,
        inboundArrivalAirport: row.inboundArrivalAirport ?? undefined,
        inboundArrivalAt: row.inboundArrivalAt ?? undefined,
        meetingInfoRaw: row.meetingInfoRaw ?? undefined,
        meetingPointRaw: row.meetingPointRaw ?? undefined,
        meetingTerminalRaw: row.meetingTerminalRaw ?? undefined,
        meetingGuideNoticeRaw: row.meetingGuideNoticeRaw ?? undefined,
      }))
      await upsertProductDepartures(prisma, product.id, departureInputs)
    }

    const itineraryDayInputs = registerScheduleToDayInputs(scheduleWithImages)
    if (itineraryDayInputs.length > 0) {
      await upsertItineraryDays(prisma, product.id, itineraryDayInputs)
    }

    console.log(`[STEP 2] 텍스트 및 달력 DB 1차 저장 성공 (가격 ${priceRows.length}건, 사진은 후행 수확)`)

    // 편집 가능한 parsed 객체 반환 (ParsedProductForDB 형식) — 클라이언트·내부 도구용
    const parsedForClient = {
      originSource,
      originCode,
      title,
      destination: (data.destination as string)?.trim?.() || '미지정',
      airportTransferType: inferAirportTransferType(rawText),
      productType: (data.productType as string)?.trim?.() || 'travel',
      airtelHotelInfoJson: data.hotelInfo ? JSON.stringify(data.hotelInfo) : null,
      duration: (data.duration as string)?.trim?.() || '미지정',
      airline: (data.airline as string)?.trim?.() || undefined,
      mandatoryLocalFee: null as number | null,
      mandatoryCurrency: null as string | null,
      includedText: null as string | null,
      excludedText: null as string | null,
      counselingNotes: null,
      criticalExclusions: null as string | null,
      prices: priceRows.map((row) => ({
        date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
        adultBase: row.adult,
        adultFuel: 0,
        childBedBase: row.childBed || undefined,
        childNoBedBase: row.childNoBed || undefined,
        childFuel: 0,
        infantBase: row.infant || undefined,
        infantFuel: 0,
        status: '예약가능' as const,
        availableSeats: 0,
      })),
      surcharges: [],
      itineraries: scheduleWithImages.map((s, i) => ({ day: s.day, description: s.description || '' })),
    }

    console.log(`${PARSE_STEP} 5. 결과 반환 (productId: ${product.id}, parsed.prices: ${parsedForClient.prices?.length ?? 0}건)`)
    return NextResponse.json({
      success: true,
      productId: product.id,
      parsed: parsedForClient,
      ...(debugSupplier && {
        supplierInputDebug: buildParseSupplierInputDebug({
          requestRaw: clientOriginSourceRaw,
          coerced: originSourceCoerced,
          effective: originSource,
        }),
      }),
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '파싱 실패'
    console.error(`${PARSE_STEP} 예외 (전체 스택):`, error instanceof Error ? (error as Error).stack : error)
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 })
  }
}
