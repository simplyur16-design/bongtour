/**
 * 한진투어 상세 본문 HTML → 공통 base 상품 1건.
 * 패턴은 업로드 본문에 실제로 등장하는 한글 라벨(상품코드, 여행기간, N일차 등) 기준.
 */
import {
  HANJINTOUR_ORIGIN_SOURCE,
  HANJINTOUR_SUPPLIER_KEY,
  type HanjintourBaseParsedProduct,
} from '@/DEV/lib/hanjintour-types'
import {
  optionalTourRowsToSummary,
  parseHanjintourOptionalTourTableSsot,
} from '@/DEV/lib/hanjintour-optional-tours-from-table'
import {
  parseHanjintourScheduleFromBody,
  parseHanjintourScheduleFromHtml,
} from '@/DEV/lib/hanjintour-schedule-from-body'

export type ParseHanjintourBaseProductOptions = {
  /** 탭 구분 표 텍스트 — 있으면 optional_tours_structured·요약을 표 기준으로 덮어쓴다 */
  optionalTourTableSsot?: string | null
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** `<pre>` 붙여넣 본문은 줄바꿈 유지(상품명 1줄 추출용) */
function extractPlainWithNewlines(detailHtml: string): string | null {
  const preM = detailHtml.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)
  if (!preM?.[1]) return null
  return preM[1]!
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/\r\n/g, '\n')
    .trim()
}

function pickInt(s: string | undefined): number | null {
  if (!s) return null
  const n = Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function normalizeTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/[\[\(（【][^\]】)）\]]*[\]】)）]/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * 본문 HTML에서 공통 메타 + 일정을 구조화한다.
 */
export function parseHanjintourBaseProduct(
  detailHtml: string,
  options?: ParseHanjintourBaseProductOptions
): HanjintourBaseParsedProduct {
  const notes: string[] = []
  const plainNl = extractPlainWithNewlines(detailHtml)
  const plain = plainNl ? plainNl.replace(/\s+/g, ' ').trim() : stripTags(detailHtml)

  let product_code: string | null = null
  const codeM =
    plain.match(/상품\s*코드\s*[：:]\s*([A-Za-z0-9\-_]+)/u) ||
    plain.match(/상품코드\s*[：:]\s*([A-Za-z0-9\-_]+)/u) ||
    plain.match(/상품코드\s+([A-Za-z0-9\-_]+)/u)
  if (codeM?.[1]) product_code = codeM[1]!.trim()
  else notes.push('product_code: not found')

  let product_title: string | null = null
  let titleHeuristicPending = false
  const titleM =
    plain.match(/상품\s*명\s*[：:]\s*([^\n]+)/u) || plain.match(/상품명\s*[：:]\s*([^\n]+)/u)
  if (titleM?.[1]) product_title = titleM[1]!.trim().slice(0, 500)
  else {
    const h1 = detailHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    if (h1?.[1]) product_title = stripTags(h1[1]).slice(0, 500)
    else titleHeuristicPending = true
  }
  if (!product_title && plainNl && product_code) {
    const lines = plainNl.split(/\n/).map((l) => l.trim()).filter(Boolean)
    const idx = lines.findIndex((l) => new RegExp(`상품코드\\s+${product_code}`, 'u').test(l))
    if (idx >= 0 && lines[idx + 1]) {
      product_title = lines[idx + 1]!.split(/여행핵심정보/u)[0]!.trim().slice(0, 200)
      notes.push('product_title: next line after 상품코드 (pre)')
    }
  }
  if (!product_title && product_code) {
    const legacy = plain.match(new RegExp(`상품코드\\s+${product_code}\\s+([^\\n]+)`, 'u'))
    if (legacy?.[1]) {
      product_title = legacy[1]!.split(/여행핵심정보/u)[0]!.trim().slice(0, 200)
      notes.push('product_title: line after 상품코드 (trimmed)')
    }
  }
  if (!product_title) {
    const alt = plain.match(/상품코드\s+[A-Za-z0-9\-_]+\s+([^\n]+)/u)
    if (alt?.[1]) {
      product_title = alt[1]!.split(/여행핵심정보/u)[0]!.trim().slice(0, 200)
      notes.push('product_title: generic line after 상품코드 (trimmed)')
    }
  }
  if (!product_title && titleHeuristicPending) notes.push('product_title: heuristic only')

  let trip_nights: number | null = null
  let trip_days: number | null = null
  const tripM =
    plain.match(/여행\s*기간\s*[：:]\s*(\d+)\s*박\s*(\d+)\s*일/u) ||
    plain.match(/(\d+)\s*박\s*(\d+)\s*일/u)
  if (tripM) {
    trip_nights = pickInt(tripM[1]!) ?? trip_nights
    trip_days = pickInt(tripM[2]!) ?? trip_days
  } else notes.push('trip_nights/days: not found')

  const priceBlock =
    plain.match(/(?:성인|소아|유아)[\s\S]{0,800}?원/u)?.[0] ?? plain.slice(0, 4000)
  let base_price_adult: number | null = null
  let base_price_child: number | null = null
  let base_price_infant: number | null = null
  const adultM =
    priceBlock.match(/성인[^\d]{0,20}(\d{1,3}(?:,\d{3})+|\d{4,8})\s*원?/u) ||
    plain.match(/성인[\s\S]{0,80}?(\d{1,3}(?:,\d{3})+|\d{4,8})\s*원/u)
  const childM = priceBlock.match(/소아[^\d]{0,20}(\d{1,3}(?:,\d{3})+|\d{4,8})\s*원?/u)
  const infantM = priceBlock.match(/유아[^\d]{0,20}(\d{1,3}(?:,\d{3})+|\d{4,8})\s*원?/u)
  if (adultM?.[1]) base_price_adult = pickInt(adultM[1])
  if (childM?.[1]) base_price_child = pickInt(childM[1])
  if (infantM?.[1]) base_price_infant = pickInt(infantM[1])
  if (base_price_adult == null) notes.push('base_price_adult: not found in body snippet')

  let local_join_price: number | null = null
  const lj = plain.match(/현지\s*합류[^\d]{0,40}?(\d{1,3}(?:,\d{3})+|\d{4,8})\s*원/u)
  if (lj?.[1]) local_join_price = pickInt(lj[1])

  let airline_holder_price: number | null = null
  const ah =
    plain.match(/(?:항공권\s*소지자|항공\s*소지)[^\d]{0,40}(\d{1,3}(?:,\d{3})+|\d{4,8})\s*원?/u)
  if (ah?.[1]) airline_holder_price = pickInt(ah[1])

  let guide_driver_tip: string | null = null
  const gdTight = plain.match(
    /가이드\s*경비\s*가이드\s*경비\s*(\d+\s*USD\([^)]+\))/u
  )
  const gdLoose = plain.match(/(?:기사\s*[·/]\s*가이드|가이드)\s*경비[^\n]{0,80}/u)
  if (gdTight?.[1]) guide_driver_tip = gdTight[1]!.trim().slice(0, 120)
  else if (gdLoose?.[0]) guide_driver_tip = gdLoose[0]!.trim().slice(0, 120)

  let shopping_count: number | null = null
  const shop = plain.match(/쇼핑(?:\s*쇼핑)?\s*(\d+)\s*회/u)
  if (shop?.[1]) shopping_count = pickInt(shop[1])

  let optional_tour_summary: string | null = null
  if (/선택\s*관광/u.test(plain)) {
    const ot = plain.match(/선택\s*관광[^\n.]{0,200}/u)
    optional_tour_summary = ot?.[0]?.trim() ?? '선택관광 있음'
  }

  let optional_tours_structured = parseHanjintourOptionalTourTableSsot(
    (options?.optionalTourTableSsot ?? '').trim()
  )
  if (optional_tours_structured.length > 0) {
    optional_tour_summary = optionalTourRowsToSummary(optional_tours_structured)
  }

  const included_items: string[] = []
  const excluded_items: string[] = []
  const inc = plain.match(/포함\s*사항\s*[：:]\s*([\s\S]{0,2000}?)(?=불포함|미포함|$)/u)
  if (inc?.[1]) {
    for (const line of inc[1].split(/[•·\n]/u)) {
      const t = line.trim()
      if (t.length > 2) included_items.push(t.slice(0, 500))
    }
  }
  const exc = plain.match(/(?:불포함|미포함)\s*사항\s*[：:]\s*([\s\S]{0,2000}?)(?=포함|$)/u)
  if (exc?.[1]) {
    for (const line of exc[1].split(/[•·\n]/u)) {
      const t = line.trim()
      if (t.length > 2) excluded_items.push(t.slice(0, 500))
    }
  }

  const extra_charge_items: string[] = []
  const ext = plain.match(/(?:별도\s*경비|현지\s*지불)[^\n]{0,400}/u)
  if (ext?.[0]) extra_charge_items.push(ext[0].trim())

  let hotel_summary: string | null = null
  const hotel = plain.match(/(?:호텔|숙박)\s*[：:][^\n]{0,300}/u)
  if (hotel?.[0]) hotel_summary = hotel[0].trim()

  let flight_summary: string | null = null
  const flight = plain.match(
    /(?:대한항공|아시아나|OZ|KE|티웨이|진에어|에어부산)[^\n]{0,200}/u
  )
  if (flight?.[0]) flight_summary = flight[0].trim()

  let main_points: string | null = null
  const mp = plain.match(/(?:핵심\s*포인트|여행\s*포인트)\s*[：:]\s*([\s\S]{0,1200}?)(?=\d+\s*일차|일정|$)/u)
  if (mp?.[1]) main_points = mp[1].trim().slice(0, 2000)

  let schedule = plainNl ? parseHanjintourScheduleFromBody(plainNl) : []
  if (schedule.length === 0) {
    schedule = parseHanjintourScheduleFromHtml(detailHtml)
  }
  if (schedule.length === 0) notes.push('schedule: no N일차 blocks found')

  const price_table_raw_text = priceBlock.length > 50 ? priceBlock.slice(0, 8000) : null

  return {
    supplier: HANJINTOUR_SUPPLIER_KEY,
    originSource: HANJINTOUR_ORIGIN_SOURCE,
    product_code,
    product_title,
    product_title_normalized: product_title ? normalizeTitle(product_title) : null,
    trip_nights,
    trip_days,
    base_price_adult,
    base_price_child,
    base_price_infant,
    local_join_price,
    airline_holder_price,
    guide_driver_tip,
    shopping_count,
    optional_tour_summary,
    optional_tours_structured,
    included_items,
    excluded_items,
    extra_charge_items,
    hotel_summary,
    flight_summary,
    main_points,
    price_table_raw_text,
    schedule,
    parse_notes: notes,
  }
}
