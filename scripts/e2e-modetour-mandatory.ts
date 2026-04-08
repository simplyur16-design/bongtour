/**
 * brandKey=modetour 상품 1건 필수 E2E 검증 (대체 상품 없음 — 없으면 exit 1).
 *
 * 검증:
 * - (데이터) 항공·가격·아동·유아·옵션·쇼핑·일정 — DB/rawMeta/병합 행 기준
 * - (선택) E2E_BASE_URL 설정 시 공개 상세 GET /products/[id]
 * - (선택) E2E_BASE_URL + E2E_ADMIN_COOKIE 시 관리자 preview POST (동일 본문 재파싱)
 *
 *   npx tsx scripts/e2e-modetour-mandatory.ts
 *
 * confirm 은 DB에 이미 반영된 상품으로 "저장 완료 상태"를 데이터 검증으로 대체한다.
 * 실제 confirm 버튼 재실행은 운영 데이터 변경이 되므로 이 스크립트에서 강제하지 않는다.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { parseProductRawMetaPublic } from '../lib/public-product-extras'
import { buildModetourDirectedSegmentLinesFromFlightRaw } from '../lib/flight-modetour-parser'
import {
  mergeProductPriceRowsWithBodyPriceTable,
  productDeparturesToProductPriceRows,
} from '../lib/product-departure-to-price-rows-modetour'
import { getPublicPerPaxUnitKrw } from '../lib/price-utils'
import { extractProductPriceTableByLabels } from '../lib/product-price-table-extract'

type Row = { ok: boolean; detail: string }

type ModetourProduct = Prisma.ProductGetPayload<{
  include: {
    brand: { select: { brandKey: true; displayName: true } }
    departures: true
    itineraryDays: true
    optionalTours: true
  }
}>

function countOptionalStructured(product: ModetourProduct, structured: Record<string, unknown> | undefined): number {
  const canon = structured?.optionalToursStructuredCanonical as { rows?: unknown[] } | undefined
  if (Array.isArray(canon?.rows) && canon.rows.length > 0) return canon.rows.length
  const raw = product.optionalToursStructured?.trim()
  if (!raw) return 0
  try {
    const j = JSON.parse(raw) as { rows?: unknown[] }
    return Array.isArray(j?.rows) ? j.rows.length : 0
  } catch {
    return raw.length > 50 ? 1 : 0
  }
}

function countShoppingStructured(structured: Record<string, unknown> | undefined): number {
  const shop = structured?.shoppingStructured as { rows?: unknown[] } | undefined
  return Array.isArray(shop?.rows) ? shop.rows.length : 0
}

function hasSchedule(product: ModetourProduct): boolean {
  const s = product.schedule?.trim()
  if (!s) return false
  try {
    const j = JSON.parse(s) as unknown
    return Array.isArray(j) && j.length > 0
  } catch {
    return s.length > 20
  }
}

async function tryAdminPreviewHttp(args: {
  baseUrl: string
  cookie: string
  text: string
  originSource: string
  originUrl: string | null
}): Promise<Row> {
  const url = `${args.baseUrl.replace(/\/$/, '')}/api/travel/parse-and-register-modetour`
  const body = {
    text: args.text,
    mode: 'preview',
    brandKey: 'modetour',
    originSource: args.originSource,
    originUrl: args.originUrl ?? undefined,
    travelScope: 'overseas',
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: args.cookie,
      },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status} ${json.error ?? res.statusText}` }
    }
    if (json.success === false) {
      return { ok: false, detail: json.error ?? 'success=false' }
    }
    return { ok: true, detail: 'parse-and-register-modetour preview 200' }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}

async function tryPublicDetailHttp(baseUrl: string, productId: string): Promise<Row> {
  const url = `${baseUrl.replace(/\/$/, '')}/products/${productId}`
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) return { ok: false, detail: `GET ${url} → ${res.status}` }
    const html = await res.text()
    if (html.length < 500) return { ok: false, detail: '응답 본문 과소' }
    return { ok: true, detail: `GET ${url} → ${res.status}, len=${html.length}` }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}

async function main() {
  const include = {
    brand: { select: { brandKey: true, displayName: true } },
    departures: { orderBy: { departureDate: 'asc' as const }, take: 25 },
    itineraryDays: { orderBy: { day: 'asc' as const }, take: 30 },
    optionalTours: { take: 50 },
  } satisfies Prisma.ProductInclude

  const product = (await prisma.product.findFirst({
    where: { brand: { brandKey: 'modetour' } },
    orderBy: { updatedAt: 'desc' },
    include,
  })) as ModetourProduct | null

  if (!product) {
    console.error('[E2E FAIL] brand.brandKey === "modetour" 인 상품이 DB에 없습니다. 완료 판정 불가.')
    await prisma.$disconnect()
    process.exit(1)
    return
  }

  if (product.brand?.brandKey !== 'modetour') {
    console.error('[E2E FAIL] 브랜드 불일치:', product.brand?.brandKey)
    await prisma.$disconnect()
    process.exit(1)
    return
  }

  const rawParsed = parseProductRawMetaPublic(product.rawMeta ?? null)
  const structured = rawParsed?.structuredSignals as Record<string, unknown> | undefined
  const flightRaw = (structured?.flightRaw as string | null | undefined) ?? null
  const ppt = structured?.productPriceTable as Record<string, unknown> | null | undefined
  const modSeg = buildModetourDirectedSegmentLinesFromFlightRaw(flightRaw)
  const detailNorm = (structured?.detailBodyNormalizedRaw as string | null | undefined)?.trim() ?? ''
  const fs = structured?.flightStructured as { debug?: { status?: string } } | undefined

  const priceRows = productDeparturesToProductPriceRows(product.departures ?? [])
  const merged = mergeProductPriceRowsWithBodyPriceTable(priceRows, ppt ?? null)
  const row0 = merged[0]

  const gates: Record<string, Row> = {}

  gates.flight = (() => {
    const hasRaw = (flightRaw ?? '').length >= 80
    const hasDirected = Boolean(modSeg?.departureLine?.trim() && modSeg?.returnLine?.trim())
    const dep0 = product.departures?.[0]
    const hasDepDb =
      Boolean(dep0?.outboundFlightNo?.trim()) ||
      Boolean(dep0?.inboundFlightNo?.trim()) ||
      Boolean(dep0?.outboundDepartureAirport?.trim())
    const fsOk = fs?.debug?.status === 'success' || fs?.debug?.status === 'partial'
    if (hasDirected || (hasRaw && fsOk) || hasDepDb) {
      return {
        ok: true,
        detail: `directed=${hasDirected} rawLen=${(flightRaw ?? '').length} depFlight=${hasDepDb} fs=${fs?.debug?.status ?? 'n/a'}`,
      }
    }
    return { ok: false, detail: '항공: directed·rawMeta·출발행 항공 필드 모두 부족' }
  })()

  gates.adultPrice = (() => {
    const adult = row0 ? getPublicPerPaxUnitKrw(row0, 'adult') : null
    const fromTable = typeof ppt?.adultPrice === 'number' ? ppt.adultPrice : null
    if (adult != null && adult > 0) return { ok: true, detail: `첫 출발 성인 ${adult}` }
    if (fromTable != null && fromTable > 0) return { ok: true, detail: `productPriceTable 성인 ${fromTable}` }
    return { ok: false, detail: '기본(성인) 가격 없음' }
  })()

  gates.childPrices = (() => {
    if (!row0) {
      const raw = (structured?.priceTableRawText as string | undefined) ?? ''
      const ex = raw.trim() ? extractProductPriceTableByLabels(raw) : null
      if (
        ex &&
        ex.childExtraBedPrice != null &&
        ex.childNoBedPrice != null &&
        ex.infantPrice != null
      ) {
        return { ok: true, detail: '출발행 없음·본문 가격표에서 4슬롯 추출' }
      }
      return { ok: false, detail: '출발일 행 없음 + 본문 4슬롯 추출 실패' }
    }
    const bed = getPublicPerPaxUnitKrw(row0, 'childBed')
    const noBed = getPublicPerPaxUnitKrw(row0, 'childNoBed')
    const inf = getPublicPerPaxUnitKrw(row0, 'infant')
    const miss = [bed, noBed, inf].some((x) => x == null)
    if (!miss) return { ok: true, detail: `childBed=${bed} childNoBed=${noBed} infant=${inf}` }
    const raw = (structured?.priceTableRawText as string | undefined) ?? ''
    const ex = raw.trim() ? extractProductPriceTableByLabels(raw) : null
    if (
      ex &&
      ex.childExtraBedPrice != null &&
      ex.childNoBedPrice != null &&
      ex.infantPrice != null
    ) {
      return { ok: true, detail: '행 일부 null이나 본문 가격표 4슬롯 추출 성공(병합 경로 확인)' }
    }
    return { ok: false, detail: `아동/유아: row childBed=${bed} noBed=${noBed} infant=${inf}` }
  })()

  gates.options = (() => {
    const nTable = product.optionalTours?.length ?? 0
    const nStruct = countOptionalStructured(product, structured)
    if (nTable > 0 || nStruct > 0) return { ok: true, detail: `OptionalTour=${nTable} structured≈${nStruct}` }
    if (product.hasOptionalTours && (product.optionalToursStructured?.length ?? 0) > 100) {
      return { ok: true, detail: 'hasOptionalTours + optionalToursStructured 원문 존재' }
    }
    return { ok: false, detail: '옵션 테이블·구조화 신호 없음' }
  })()

  gates.shopping = (() => {
    const n = countShoppingStructured(structured)
    const stops = typeof structured?.shoppingStops === 'string' ? structured.shoppingStops.trim().length : 0
    const visit = product.shoppingVisitCountTotal
    if (n > 0 || stops > 20 || (visit != null && visit > 0)) {
      return { ok: true, detail: `rows=${n} stopsLen=${stops} visit=${visit ?? 'null'}` }
    }
    return { ok: false, detail: '쇼핑 구조화·stops·횟수 없음' }
  })()

  gates.itinerary = (() => {
    const nDay = product.itineraryDays?.length ?? 0
    if (nDay > 0) return { ok: true, detail: `itineraryDays=${nDay}` }
    if (hasSchedule(product)) return { ok: true, detail: 'Product.schedule JSON 존재' }
    return { ok: false, detail: 'itineraryDays·schedule 모두 없음' }
  })()

  gates.admin_confirm_state = {
    ok: true,
    detail: '상품·출발일·rawMeta가 DB에 존재 → 과거 confirm 반영 상태로 간주(이 스크립트는 재저장하지 않음)',
  }

  const baseUrl = process.env.E2E_BASE_URL?.trim()
  const adminCookie = process.env.E2E_ADMIN_COOKIE?.trim()

  if (baseUrl) {
    gates.public_detail = await tryPublicDetailHttp(baseUrl, product.id)
  } else {
    gates.public_detail = { ok: false, detail: 'SKIP: E2E_BASE_URL 미설정' }
  }

  if (baseUrl && adminCookie && detailNorm.length >= 200) {
    gates.admin_preview_http = await tryAdminPreviewHttp({
      baseUrl,
      cookie: adminCookie,
      text: detailNorm.slice(0, 120_000),
      originSource: product.originSource,
      originUrl: product.originUrl,
    })
  } else {
    gates.admin_preview_http = {
      ok: false,
      detail:
        baseUrl && adminCookie
          ? 'SKIP: rawMeta.detailBodyNormalizedRaw 부족(200자 미만)'
          : 'SKIP: E2E_BASE_URL 또는 E2E_ADMIN_COOKIE 미설정',
    }
  }

  console.log('\n=== 모두투어 E2E (brandKey=modetour 필수) ===')
  console.log('productId:', product.id)
  console.log('title:', product.title?.slice(0, 72))
  console.log('brand:', product.brand?.brandKey, product.brand?.displayName)

  const order = [
    'flight',
    'adultPrice',
    'childPrices',
    'options',
    'shopping',
    'itinerary',
    'admin_confirm_state',
    'admin_preview_http',
    'public_detail',
  ] as const

  let hardFail = false
  for (const key of order) {
    const r = gates[key]
    const label = key
    const mark = r.ok ? 'PASS' : key === 'admin_preview_http' || key === 'public_detail' ? 'SKIP/FAIL' : 'FAIL'
    if (!r.ok && mark === 'FAIL') hardFail = true
    console.log(`[${mark}] ${label}: ${r.detail}`)
  }

  console.log(
    '\n※ 관리자 confirm: 운영 데이터 보호를 위해 API 재호출 없음. 위 DB 검증으로 저장 반영 상태를 확인한다.'
  )
  console.log(
    '※ 관리자 preview HTTP: E2E_BASE_URL + E2E_ADMIN_COOKIE + detailBodyNormalizedRaw 필요.'
  )
  console.log('※ 공개 상세 HTTP: E2E_BASE_URL 만으로 /products/[id] 200 확인.\n')

  await prisma.$disconnect()

  if (hardFail) {
    console.error('[E2E FAIL] 데이터 검증 항목 중 실패가 있습니다.')
    process.exit(1)
    return
  }

  if (!baseUrl) {
    console.error(
      '[E2E FAIL] 공개 상세 확인을 위해 E2E_BASE_URL(예: http://localhost:3000)을 설정하세요.'
    )
    process.exit(1)
    return
  }

  if (!gates.public_detail.ok) {
    console.error('[E2E FAIL] 공개 상세 GET 실패:', gates.public_detail.detail)
    process.exit(1)
    return
  }

  if (!adminCookie) {
    console.error(
      '[E2E FAIL] 관리자 미리보기 확인을 위해 E2E_ADMIN_COOKIE(관리자 세션 Cookie 헤더 값)를 설정하세요.'
    )
    process.exit(1)
    return
  }

  if (detailNorm.length < 200) {
    console.error(
      '[E2E FAIL] 관리자 미리보기 재현용 rawMeta.detailBodyNormalizedRaw 가 200자 미만입니다.'
    )
    process.exit(1)
    return
  }

  if (!gates.admin_preview_http.ok) {
    console.error('[E2E FAIL] 관리자 preview API 실패:', gates.admin_preview_http.detail)
    process.exit(1)
    return
  }

  console.log(
    '[E2E PASS] modetour: 데이터 + 공개 상세 GET + 관리자 preview POST 확인. confirm 은 DB 반영 상태로 데이터 검증만 수행.\n'
  )
  process.exit(0)
}

main().catch(async (e) => {
  console.error(e)
  try {
    await prisma.$disconnect()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
