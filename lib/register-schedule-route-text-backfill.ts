/**
 * 등록 schedule — imageKeyword apply 전 routeText 최소 보정 (서버 post-augment·클라이언트 preview 공용).
 * REGRESSION-FREEZE[register-schedule-route-expression-normalize]: 신규 등록 routeText·요약 오염 차단 — manifest
 * REGRESSION-FREEZE[register-schedule-route-text-single-poi-expand]: 단일 POI·도시 routeText 2세그먼트 승격 — manifest
 */
import {
  isRegisterScheduleGenericTourismFillerRouteText,
  isRegisterScheduleRoutePlaceNoise,
  sanitizeRegisterScheduleRouteText,
} from '@/lib/register-schedule-route-place-noise'
import { splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { isHotelLodgingImageKeyword } from '@/lib/pexels-place-name-keyword'

export type RegisterScheduleRouteTextBackfillRow = {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
}

const REGISTER_SCHEDULE_ROUTE_EXPRESSION_MAX = 7

/** 리조트 자유·부대시설 일차 — 인접일 관광 routeText 복사 금지 */
export function isRegisterScheduleFreeTimeOrResortLeisureText(text: string | null | undefined): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  // REGRESSION-FREEZE[register-schedule-route-expression-normalize]: 자유시간·자유일정·리조트일 인접 관광 route 복사 금지 — manifest
  return /자유\s*시간|자유\s*일정|리조트\s*(?:내\s*)?부대|전일\s*리조트|호텔\s*(?:내\s*)?자유|체크\s*아웃|레이트\s*체크|숙박\s*없음(?:\s*\(귀국\))?/i.test(
    t,
  )
}

/** 호텔·숙박명 only route — 인접일 관광(라운지·호핑) 세그먼트 병합 금지 */
// REGRESSION-FREEZE[register-schedule-route-expression-normalize]: AMP7017 hotel-only ≠ KK lounge steal — manifest
export function isRegisterScheduleHotelOnlyRouteText(text: string | null | undefined): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  if (isRegisterScheduleFreeTimeOrResortLeisureText(t)) return false
  const segs = splitRouteTextPlaceSegments(t)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  if (!segs.length) return false
  return segs.every(
    (s) =>
      isHotelLodgingImageKeyword(s) ||
      /(?:호텔|Hotel|Resort|리조트|펜션|모텔|게스트하우스|판보르네오|Pan\s*Borneo)/i.test(s),
  )
}

/** modetour·API placeholder routeText — 인접일 backfill 대상 */
export function isRegisterSchedulePlaceholderRouteText(routeText: string | null | undefined): boolean {
  const t = String(routeText ?? '').trim()
  if (!t) return true
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 홍콩 디즈니랜드 ≠ Tokyo/Shanghai — manifest
  // 당일 전용 테마파크·명소 단독 route는 placeholder가 아님 — 인접일 Peak 붙이기 금지
  if (/(?:디즈니|Disney|유니버설|USJ|에버랜드|롯데월드|테마파크|란타우|Lantau)/i.test(t)) return false
  // REGRESSION-FREEZE[register-schedule-route-expression-normalize]: 자유시간·리조트일은 placeholder로 보지 않음 — manifest
  if (isRegisterScheduleFreeTimeOrResortLeisureText(t)) return false
  // REGRESSION-FREEZE[register-schedule-route-expression-normalize]: AMP7017 hotel-only ≠ KK lounge steal — manifest
  if (isRegisterScheduleHotelOnlyRouteText(t)) return false
  if (isRegisterScheduleGenericTourismFillerRouteText(t)) return true
  const segs = t.split(/\s+-\s+/).map((s) => s.trim()).filter(Boolean)
  if (!segs.length) return true
  const meaningful = segs.filter((s) => !isRegisterScheduleRoutePlaceNoise(s) && s.length >= 3)
  return meaningful.length < 2
}

/** 단일 세그먼트 routeText — gate·kw2용 2세그먼트 승격(한글 라벨 SSOT — 영어 POI 금지) */
const SINGLE_SEGMENT_ROUTE_EXPAND_KO: Readonly<Record<string, string>> = {
  피사: '피사 대성당',
  융프라우: '스핑크스 전망대',
  케이프타운: '테이블 마운틴',
  CAPETOWN: '테이블 마운틴',
  이과수: '악마의 목구멍',
  푸꾸옥: '푸꾸옥 손트랑',
  푸꾹옥: '푸꾸옥 손트랑',
  몰디브: '몰디브 오버워터 빌라',
  Maldives: 'Maldives overwater villa',
  라오스: '비엔티엔 파 That Luang',
  비엔티엔: '파 That Luang',
  프라하: '프라하 성',
  부다페스트: '헝가리 국회의사당',
  두브로브니크: '두브로브니크 올드타운',
  할슈타트: '할슈타트 호수',
  괌: '투몬 비치',
  // REGRESSION-FREEZE[lottetour-schedule-plan-info-description]: 요나고 route 한글 승격 — EN Mount Daisen 금지 — manifest
  요나고: '다이센',
  돗토리: '돗토리 사구',
  쿠라요시: '쿠라요시 백벽',
}

function expandSingleSegmentRouteLabel(seg: string): string | null {
  const t = String(seg ?? '').trim()
  if (!t) return null
  const direct = SINGLE_SEGMENT_ROUTE_EXPAND_KO[t] ?? SINGLE_SEGMENT_ROUTE_EXPAND_KO[t.toUpperCase()]
  if (direct) return direct
  // 영어 SSOT(en)를 routeText에 넣지 않음 — imageKeyword 전용
  return null
}

/** 단일 POI·도시 routeText → `A - B` (live gate routeText 최소 길이·kw2 보조) */
export function expandSingleSegmentPoiRouteTextRows<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  return rows.map((row) => {
    const route = String(row.routeText ?? '').trim()
    if (!route || /\s[-–—→]\s/u.test(route)) return row
    const segs = splitRouteTextPlaceSegments(route).filter((s) => s.trim().length >= 2)
    if (segs.length !== 1) return row
    const seg = segs[0]!.trim()
    const haystack = `${seg} ${String(row.title ?? '')} ${String(row.description ?? '')}`
    const second =
      expandSingleSegmentRouteLabel(seg) ??
      expandSingleSegmentRouteLabel(haystack.trim()) ??
      (/이과수|Iguazu|세계\s*3대\s*폭포|악마의\s*목구멍/u.test(haystack) ? '이과수 폭포 악마의 목구멍' : null) ??
      (/(?:코르코바도|Corcovado)/u.test(haystack) ? '코르코바도' : null) ??
      (/(?:리우\s*데|리오\s*데|Rio\s*de\s*Janeiro)/u.test(haystack) && !/(?:이과수|Iguazu|악마의\s*목구멍)/u.test(haystack)
        ? '코르코바도'
        : null)
    if (!second || second === seg) return row
    return { ...row, routeText: `${seg} - ${second}`.slice(0, 500) }
  })
}

/** API·LLM placeholder 요약 — 장소 동선이 있으면 description에 쓰지 않음 */
export function isRegisterScheduleGenericTourismFillerDescription(
  desc: string | null | undefined,
): boolean {
  const t = String(desc ?? '').trim()
  if (!t) return true
  if (isRegisterScheduleGenericTourismFillerRouteText(t)) return true
  return /세련된 번화가|걷는 즐거움이|알찬 도보|이동과 관광이|여정의 여운|귀국길로 이어지|현지 도착 후 첫날|마무리 관광 뒤/i.test(
    t,
  )
}

/**
 * 신규 등록 일차 표현 — routeText a–g만 SSOT. 마케팅 카드·placeholder 요약은 title/description에 넣지 않음.
 * (기존 DB 재파싱이 아니라 parse → preview → confirm 경로 전 공급사 공통)
 */
export function normalizeRegisterScheduleRouteExpressionRow<T extends RegisterScheduleRouteTextBackfillRow>(
  row: T,
): T {
  const routeText =
    sanitizeRegisterScheduleRouteText(row.routeText, REGISTER_SCHEDULE_ROUTE_EXPRESSION_MAX) ??
    sanitizeRegisterScheduleRouteText(row.title, REGISTER_SCHEDULE_ROUTE_EXPRESSION_MAX)
  if (!routeText) return row

  const title = String(row.title ?? '').trim()
  const description = String(row.description ?? '').trim()
  const titleLooksLikeRoute = /\s[-–—→]\s/u.test(title)
  const nextTitle =
    !title ||
    title === `${row.day}일차` ||
    isRegisterScheduleGenericTourismFillerDescription(title) ||
    (titleLooksLikeRoute && title.length > routeText.length)
      ? routeText
      : title
  const nextDescription = isRegisterScheduleGenericTourismFillerDescription(description)
    ? description
    : description && description !== routeText && !description.startsWith(`${routeText}\n`)
      ? description
      : ''

  return {
    ...row,
    routeText,
    title: nextTitle,
    description: nextDescription,
  }
}

export function normalizeRegisterScheduleRouteExpressionRows<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  return rows.map((row) => normalizeRegisterScheduleRouteExpressionRow(row))
}

/** 마지막·기내박 일차 — routeText 없을 때 title로 최소 보정 */
export function backfillEmptyScheduleRouteTextFromTitle<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  if (!rows.length) return rows
  const maxDay = Math.max(...rows.map((r) => Number(r.day)).filter((d) => d > 0))
  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0 || String(row.routeText ?? '').trim()) return row
    const title = String(row.title ?? '').trim()
    const desc = String(row.description ?? '').trim()
    if (title && title.length >= 8 && /\s[-–—→]\s/u.test(title)) {
      return { ...row, routeText: title.slice(0, 500) }
    }
    // REGRESSION-FREEZE[register-schedule-route-expression-normalize]: 리조트 자유일 empty route ← title — manifest
    if (title && isRegisterScheduleFreeTimeOrResortLeisureText(title)) {
      return { ...row, routeText: title.slice(0, 500) }
    }
    if (day === maxDay) {
      for (const src of [title, desc]) {
        if (!src || src === '-') continue
        if (/숙박\s*없음|귀국|귀국편|출발/u.test(src)) {
          return {
            ...row,
            title: title && title !== '-' ? title : '숙박 없음(귀국)',
          }
        }
      }
      return { ...row, title: '숙박 없음(귀국)' }
    }
    if (/^(?:인천|김포|ICN|GMP)$/iu.test(title)) {
      return { ...row, routeText: title }
    }
    if (!title) return row
    if (/^기내박$/u.test(title)) {
      return { ...row, routeText: '기내박' }
    }
    return row
  })
}

/** description/title 1줄에 `A - B - C` 동선이 있으면 routeText로 승격 */
export function backfillMiddleDayRouteTextFromAdjacentDays<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  if (!rows.length) return rows
  const sorted = [...rows].sort((a, b) => Number(a.day) - Number(b.day))
  const maxDay = Math.max(...sorted.map((r) => Number(r.day)))
  const activeDays = sorted.filter((r) => Number(r.day) > 0).length
  return sorted.map((row) => {
    const day = Number(row.day)
    if (day <= 1 || day >= maxDay || activeDays < 4) return row
    const route = String(row.routeText ?? '').trim()
    const title = String(row.title ?? '').trim()
    // REGRESSION-FREEZE[register-schedule-route-expression-normalize]: 자유시간·리조트일에 인접 관광 route 복사 금지 — manifest
    if (
      isRegisterScheduleFreeTimeOrResortLeisureText(route) ||
      isRegisterScheduleFreeTimeOrResortLeisureText(title) ||
      isRegisterScheduleHotelOnlyRouteText(route) ||
      isRegisterScheduleHotelOnlyRouteText(title)
    ) {
      return row
    }
    // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 홍콩 디즈니랜드 ≠ Tokyo/Shanghai — manifest
    if (
      isRegisterScheduleHongKongThemeParkDayText(route) ||
      isRegisterScheduleHongKongThemeParkDayText(title)
    ) {
      return row
    }
    const segs = route ? splitRouteTextPlaceSegments(route).filter((s) => s.trim().length >= 2) : []
    if (route && segs.length >= 2 && route.length >= 4 && !isRegisterSchedulePlaceholderRouteText(route)) return row
    for (const neighbor of sorted) {
      const nd = Number(neighbor.day)
      if (nd === day) continue
      const nr = String(neighbor.routeText ?? '').trim()
      if (!nr || nr.length < 8) continue
      const nSegs = splitRouteTextPlaceSegments(nr).filter((s) => s.trim().length >= 2)
      if (nSegs.length < 2) continue
      const merged = nr.slice(0, 500)
      if (route && !merged.includes(route.slice(0, 20))) {
        return { ...row, routeText: `${route} - ${nSegs[nSegs.length - 1]!}`.slice(0, 500) }
      }
      if (!route) {
        return { ...row, routeText: merged }
      }
    }
    return row
  })
}

export function backfillScheduleRouteTextFromDescriptionOrTitle<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  return rows.map((row) => {
    if (String(row.routeText ?? '').trim()) return row
    for (const src of [String(row.description ?? '').trim(), String(row.title ?? '').trim()]) {
      if (!src) continue
      const firstLine = src.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? ''
      if (!firstLine || firstLine.length < 8) continue
      if (/\s[-–—→]\s|[-–—→].*[-–—→]/u.test(firstLine)) {
        return { ...row, routeText: firstLine.slice(0, 500) }
      }
    }
    return row
  })
}

const HK_ISLAND_KOWLOON_CORE_TOUR_SEG_RE =
  /피크\s*트램|Peak\s*Tram|빅토리아\s*피크|Victoria\s*Peak|빅토리아\s*산정|소호|SoHo|헐리우드|할리우드|Hollywood\s*Road|타이쿤|Tai\s*Kwun|에스컬레이터|Escalator|미드레벨|미드\s*레벨|웡타이신|Wong\s*Tai\s*Sin|스타의\s*거리|Avenue\s*of\s*Stars/i

/** 홍콩 디즈니·란타우 당일 — 홍콩섬·구룡 핵심투어 POI를 route에 붙이지 않음 */
export function isRegisterScheduleHongKongThemeParkDayText(text: string | null | undefined): boolean {
  return /(?:디즈니|Disney|란타우|Lantau|테마파크)/i.test(String(text ?? ''))
}

function stripHongKongCoreTourBleedFromThemeParkRouteText(routeText: string | null | undefined): string | null {
  const raw = String(routeText ?? '').trim()
  if (!raw) return null
  if (!isRegisterScheduleHongKongThemeParkDayText(raw)) {
    return sanitizeRegisterScheduleRouteText(raw, REGISTER_SCHEDULE_ROUTE_EXPRESSION_MAX)
  }
  const segs = raw.split(/\s+-\s+/).map((s) => s.trim()).filter(Boolean)
  const kept = segs.filter(
    (s) => /디즈니|Disney|란타우|Lantau/i.test(s) || !HK_ISLAND_KOWLOON_CORE_TOUR_SEG_RE.test(s),
  )
  const next = kept.join(' - ')
  return sanitizeRegisterScheduleRouteText(next, REGISTER_SCHEDULE_ROUTE_EXPRESSION_MAX) ?? (next || null)
}

/**
 * 란타우·디즈니 일차 — 인접일 Peak/소호 bleed 제거. trip에 디즈니면 란타우 단독에 디즈니랜드 보강.
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 홍콩 디즈니랜드 ≠ Tokyo/Shanghai — manifest
 */
export function sanitizeHongKongThemeParkDayRouteRows<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  const tripHasDisney = rows.some((r) =>
    /디즈니|Disney/i.test(`${String(r.routeText ?? '')} ${String(r.title ?? '')} ${String(r.description ?? '')}`),
  )
  return rows.map((row) => {
    const hay = `${String(row.routeText ?? '')} ${String(row.title ?? '')}`
    if (!isRegisterScheduleHongKongThemeParkDayText(hay)) return row
    let routeText = stripHongKongCoreTourBleedFromThemeParkRouteText(
      String(row.routeText ?? '').trim() || String(row.title ?? '').trim(),
    )
    if (
      tripHasDisney &&
      /란타우|Lantau/i.test(`${String(routeText ?? '')} ${hay}`) &&
      !/디즈니|Disney/i.test(String(routeText ?? ''))
    ) {
      const withDisney = [routeText, '홍콩 디즈니랜드'].filter(Boolean).join(' - ')
      routeText =
        sanitizeRegisterScheduleRouteText(withDisney, REGISTER_SCHEDULE_ROUTE_EXPRESSION_MAX) ?? withDisney
    }
    return routeText ? { ...row, routeText } : row
  })
}

export function prepareRegisterScheduleRowsForImageKeywordApply<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  return sanitizeHongKongThemeParkDayRouteRows(
    normalizeRegisterScheduleRouteExpressionRows(
      backfillMiddleDayRouteTextFromAdjacentDays(
        backfillScheduleRouteTextFromDescriptionOrTitle(backfillEmptyScheduleRouteTextFromTitle(rows)),
      ),
    ),
  )
}
