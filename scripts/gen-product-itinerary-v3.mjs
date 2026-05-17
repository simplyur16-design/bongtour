/**
 * 상품 1건 기준 FIT 예시 일정 Gemini v3 생성 → JSON 파일.
 * Usage: node scripts/gen-product-itinerary-v3.mjs <productId>
 */
import fs from 'node:fs'
import path from 'node:path'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  OUT_DIR,
  applySafetyMargin,
  buildV2SharedPromptSections,
  formatTimeHHMM,
  getPrisma,
  loadEnvFiles,
  parseFirstHotelName,
  parseJsonFromText,
  parseTotalDays,
  validateItineraryPayload,
} from './fit-itinerary-shared.mjs'

function buildV3Prompt(ctx) {
  const nights = ctx.totalDays - 1
  return `당신은 봉투어의 자유여행(에어텔) 예시 일정 작성 전문가입니다.
한국인 고객 대상, 따뜻하고 친근한 한국어로 작성하세요.

[이 상품의 실제 항공·호텔 정보]
- 상품: ${ctx.productTitle}
- 도시: ${ctx.cityNameKo} (${ctx.cityKey})
- 일정: ${ctx.totalDays}일 (${nights}박 ${ctx.totalDays}일)
- 항공:
  - 출발편 ${ctx.carrierName} ${ctx.outboundFlightNo}: 인천 ${ctx.outboundDepartureTime} 출발 → ${ctx.cityNameKo} ${ctx.outboundArrivalTime} 도착
  - 귀국편 ${ctx.carrierName} ${ctx.inboundFlightNo}: ${ctx.cityNameKo} ${ctx.inboundDepartureTime} 출발 → 인천 ${ctx.inboundArrivalTime} 도착
- 대표 호텔: ${ctx.hotelName} (${ctx.cityNameKo} 시내 4성급 가정. 정확한 위치는 호텔 학습 정보로 추론)
- 페르소나: 가족(부모님 동행)·커플 둘 다 적합한 중간 톤. 무리 없는 동선·검증된 맛집·접근성 좋은 관광지 중심. 한식당 1회 포함은 OK이지만 강제 X. 야경·로컬 맛집·로맨틱 스팟도 적절히.

[중요 — 항공 시간 반영]
- 출발편 도착시간이 새벽/오전이면 Day 1 본격 관광 가능, 호텔 짐 보관 후 시작
- 출발편 도착시간이 오후/저녁이면 Day 1은 호텔 체크인 + 가까운 야시장만
- 귀국편 출발시간이 새벽이면 Day ${ctx.totalDays} 새벽 호텔 출발 (전날 짐 정리)
- 귀국편 출발시간이 오후면 Day ${ctx.totalDays} 오전 짧은 관광 + 기념품
- 체크인 보통 15:00 / 체크아웃 11:00 기준. 그 사이 시간은 짐 보관 활용

[중요 — 호텔 위치 반영]
${ctx.hotelName}의 위치(학습 데이터 기반 추론)를 고려해 Day별 동선 최소화.
근접한 관광지·맛집 우선 배치. 호텔 → 첫 관광지 이동 시간 명시.
${buildV2SharedPromptSections(ctx.cityKey, ctx.totalDays)}`
}

async function main() {
  const productId = process.argv[2]?.trim()
  if (!productId) {
    console.error('Usage: node scripts/gen-product-itinerary-v3.mjs <productId>')
    process.exitCode = 1
    return
  }

  loadEnvFiles()

  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[gen-product-itinerary-v3] DATABASE_URL 미설정')
    process.exitCode = 1
    return
  }

  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) {
    console.error('[gen-product-itinerary-v3] GEMINI_API_KEY 미설정')
    process.exitCode = 1
    return
  }

  const modelName = (process.env.GEMINI_MODEL ?? 'gemini-2.5-flash').trim() || 'gemini-2.5-flash'
  const prisma = getPrisma()

  const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        country: true,
        primaryRegion: true,
        cityKey: true,
        duration: true,
        tripDays: true,
        personaLabels: true,
      },
    })
    if (!product) {
      throw new Error(`Product 없음: id=${productId}`)
    }
    if (!product.cityKey?.trim()) {
      throw new Error(`Product.cityKey 없음: id=${productId}`)
    }

    const city = await prisma.city.findUnique({
      where: { cityKey: product.cityKey },
      select: { cityKey: true, koreanLabel: true, countryKey: true },
    })
    if (!city) {
      throw new Error(`City SSOT에 cityKey="${product.cityKey}" 없음`)
    }

    const departure = await prisma.productDeparture.findFirst({
      where: { productId },
      orderBy: { departureDate: 'asc' },
      select: {
        carrierName: true,
        outboundFlightNo: true,
        outboundDepartureAt: true,
        outboundArrivalAt: true,
        inboundFlightNo: true,
        inboundDepartureAt: true,
        inboundArrivalAt: true,
      },
    })

    const itineraryDayWithHotel = await prisma.itineraryDay.findFirst({
      where: { productId, hotelText: { not: null } },
      select: { hotelText: true },
      orderBy: { day: 'asc' },
    })

    const totalDays = parseTotalDays(product.duration, product.tripDays)
    const hotelName = parseFirstHotelName(itineraryDayWithHotel?.hotelText)

    const ctx = {
      productTitle: product.title,
      cityKey: city.cityKey,
      cityNameKo: city.koreanLabel,
      totalDays,
      carrierName: departure?.carrierName?.trim() || '항공',
      outboundFlightNo: departure?.outboundFlightNo?.trim() || '—',
      outboundDepartureTime: formatTimeHHMM(departure?.outboundDepartureAt),
      outboundArrivalTime: formatTimeHHMM(departure?.outboundArrivalAt),
      inboundFlightNo: departure?.inboundFlightNo?.trim() || '—',
      inboundDepartureTime: formatTimeHHMM(departure?.inboundDepartureAt),
      inboundArrivalTime: formatTimeHHMM(departure?.inboundArrivalAt),
      hotelName,
    }

    console.log('[gen-product-itinerary-v3] product:', product.title)
    console.log(`  cityKey=${ctx.cityKey} totalDays=${totalDays} hotel=${hotelName}`)
    console.log(
      `  flight: ${ctx.carrierName} ${ctx.outboundFlightNo} ${ctx.outboundDepartureTime}→${ctx.outboundArrivalTime} / ${ctx.inboundFlightNo} ${ctx.inboundDepartureTime}→${ctx.inboundArrivalTime}`
    )
    console.log(`  model: ${modelName}`)

    const systemPrompt = buildV3Prompt(ctx)
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    })

    const userPrompt = `위 지침에 따라 ${ctx.cityNameKo} ${totalDays}일 자유여행 예시 일정 JSON만 출력하세요.
- 루트 키: title, summary, days (itinerary_title 등 다른 키 금지)
- 각 day: dayNumber, title, summary, dayCityKey, activities
- 각 activity: order, category, title, description, location, startTime, durationMinutes, estimatedCostKrw, estimatedCostNote, transportMode, transportDuration, transportCostKrw
- days 정확히 ${totalDays}개, day별 activities 최소 3개
- category는 transport/hotel/meal/attraction/shopping/tip/leisure 중 하나`

    const maxAttempts = 3
    let data
    let safetyMarginCount = 0
    let validation = { ok: false, errors: [] }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const correction =
        attempt > 1
          ? `\n\n[재시도 ${attempt}/${maxAttempts}] 이전 응답 스키마 오류:\n${validation.errors.map((e) => `- ${e}`).join('\n')}\n반드시 v2와 동일한 JSON 스키마(dayNumber, order, category 필수)로만 다시 출력.`
          : ''

      console.log(`  Gemini attempt ${attempt}/${maxAttempts}...`)
      const res = await model.generateContent(userPrompt + correction, { timeout: 300_000 })
      const text = res.response.text()
      if (!text?.trim()) throw new Error('empty Gemini response')

      data = parseJsonFromText(text)
      safetyMarginCount = applySafetyMargin(data)
      validation = validateItineraryPayload(data, totalDays)
      if (validation.ok) break
      console.log(`  attempt ${attempt} validation FAIL:`)
      for (const e of validation.errors) console.log(`    - ${e}`)
    }

    if (!validation.ok) {
      throw new Error(`검증 실패 (${maxAttempts}회): ${validation.errors.join('; ')}`)
    }

    fs.mkdirSync(OUT_DIR, { recursive: true })
    const filePath = path.join(OUT_DIR, `product-${productId}-v3.json`)
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')

    console.log('\n[gen-product-itinerary-v3] OK')
    console.log(`  file: ${filePath}`)
  console.log(`  safety margin: ${safetyMarginCount} transportDuration(s)`)
  console.log('  validation: PASS')
}

main()
  .catch((err) => {
    const msg = err instanceof Error ? err.message : err
    console.error(`[gen-product-itinerary-v3] FAILED: ${msg}`)
    if (err instanceof Error && err.stack) console.error(err.stack)
    process.exitCode = 1
  })
  .finally(async () => {
    if (globalThis.prisma) {
      await globalThis.prisma.$disconnect()
    }
    process.exit(process.exitCode ?? 0)
  })
