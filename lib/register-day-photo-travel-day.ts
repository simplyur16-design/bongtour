/**
 * 출국·귀국·이동일 일차 사진 키워드 (사장님 2026-11-21 23:13~23:14).
 * - 출국일: 그날 목적지에 도착하지 못하거나(저녁 출발·기내 숙박·익일 도착) 관광 장소가 없는 1일차 → 처음 가는 곳의 대표 사진.
 *   공항·기내 사진은 쓰지 않는다.
 * - 귀국일: 관광 장소가 없는 마지막 날 → 마지막 체류지의 대표 사진.
 * - 이동일: 관광 장소가 없는 중간 날 → 설명과 비슷한 곳. 기차·국내선·크루즈는 그 느낌의 사진.
 * 일정 글(제목·동선·설명)은 읽기만 하고 고치지 않는다. 바꾸는 것은 사진이 빈 일차의 imageKeyword 뿐이다.
 * REGRESSION-FREEZE[register-photo-travel-day-1121]: 출국=첫 목적지 대표, 귀국=마지막 체류지 대표, 이동=교통수단 느낌 — manifest
 * REGRESSION-FREEZE[photo-wrong-path-1128]: 출국·귀국·이동일은 빈칸이 아니라 체류지 대표명소로 채운다. 다른 일차 키워드는 쓰지 않는다 — manifest
 */
import { destinationEnKeysInKoreanText, koreanCityNameFromEnglish, mapDestination } from '@/lib/pexels-keyword'
import { isRegisterScheduleNoPlacePhotoDay } from '@/lib/register-schedule-day-summary-finalize'
import { registerScheduleDayIsCityOnlyPhotoSkip } from '@/lib/register-schedule-city-only-day'
import { collectRegisterScheduleCitySoftAltKeywords } from '@/lib/register-schedule-city-soft-alts'
import { sightProfile, sightsOverlap } from '@/lib/photo-autofill-sight'
import { PLACE_NAMES } from '@/lib/register-photo-match-gate'

export type TravelDayRow = {
  day: number
  title?: string | null
  routeText?: string | null
  hotelText?: string | null
  description?: string | null
  imageKeyword?: string | null
  imageUrl?: string | null
}

export type TravelDayKind = 'departure' | 'return' | 'transit'

/** 그날 도착하지 못하는 출발(기내 숙박·익일 도착) */
export const TRAVEL_DAY_OVERNIGHT_RE = /기내\s*(?:숙박|박)|익일\s*(?:\d|도착|새벽|오전)|다음\s*날\s*(?:도착|새벽)|\+\s*1\s*일?\s*도착/u
const TRAIN_RE = /기차|열차|고속철|야간열차|떼제베|\btrain\b|\brail/iu
const CRUISE_RE = /크루즈|유람선|페리|선박|\bcruise|\bferry/iu
const FLIGHT_RE = /국내선|항공\s*(?:편\s*)?이동|비행기\s*(?:로\s*)?이동|\bflight/iu

/** 한국 출발 공항 도시 — 목적지 대표 사진 후보에서 뺀다 */
const KOREA_HUB_EN_RE = /^(?:incheon|seoul|gimpo|busan|gimhae|daegu|cheongju|gwangju|jeju|muan|yangyang|korea)$/i

function blob(r: TravelDayRow): string {
  return [r.title, r.routeText, r.description].map((x) => String(x ?? '')).join(' ')
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** 글 속 해외 도시(영문) — 나온 순서대로, 한국 출발 공항 도시는 뺀다 */
export function foreignCitiesEnInText(text: string): string[] {
  const t = String(text ?? '')
  if (!t.trim()) return []
  const found: Array<{ en: string; idx: number }> = []
  const add = (en: string, idx: number) => {
    if (!en || KOREA_HUB_EN_RE.test(en.replace(/\s+/g, ''))) return
    const label = titleCase(en)
    found.push({ en: label, idx: idx >= 0 ? idx : Number.MAX_SAFE_INTEGER })
  }
  for (const key of destinationEnKeysInKoreanText(t)) {
    const en = titleCase(key)
    const ko = koreanCityNameFromEnglish(en) || koreanCityNameFromEnglish(key)
    add(en, ko ? t.indexOf(ko) : -1)
  }
  // DESTINATION_MAP 에 없는 도시(피렌체·베네치아 등)는 장소 사전 이름으로 같은 순서 보강.
  // 나라 항목이 도시 한글명(헝가리→부다페스트)을 같이 들고 있으면 나라 이름은 넣지 않는다.
  const COUNTRY_EN_RE = /^(hungary|italy|spain|france|poland|germany|austria|portugal|greece|turkey|vietnam|thailand|japan|china|korea|europe|england|uk|indonesia|malaysia|philippines|taiwan|mongolia|morocco|egypt|india|mexico|brazil|canada|australia|switzerland|netherlands|belgium|sweden|norway|denmark|finland|ireland|iceland)$/i
  const lower = t.toLowerCase()
  for (const names of Object.values(PLACE_NAMES)) {
    const en = names.find((n) => !/[가-힣]/.test(n))
    if (!en || COUNTRY_EN_RE.test(en.replace(/\s+/g, ''))) continue
    let idx = -1
    for (const n of names) {
      const i = /[가-힣]/.test(n) ? t.indexOf(n) : lower.indexOf(n.toLowerCase())
      if (i >= 0 && (idx < 0 || i < idx)) idx = i
    }
    if (idx >= 0) add(en, idx)
  }
  const out: string[] = []
  for (const f of found.sort((a, b) => a.idx - b.idx)) if (!out.includes(f.en)) out.push(f.en)
  return out
}

function destinationEn(destination: string | null | undefined): string {
  const en = mapDestination(String(destination ?? '').trim() || null)
  return en && !KOREA_HUB_EN_RE.test(en.replace(/\s+/g, '')) ? en : ''
}

function noPlaceDay(r: TravelDayRow, maxDay: number): boolean {
  return isRegisterScheduleNoPlacePhotoDay(r, maxDay) || registerScheduleDayIsCityOnlyPhotoSkip(r)
}

export function registerTravelDayKind(r: TravelDayRow, maxDay: number): TravelDayKind | null {
  const day = Number(r.day)
  const noPlace = noPlaceDay(r, maxDay)
  if (day === 1 && (noPlace || TRAVEL_DAY_OVERNIGHT_RE.test(`${blob(r)} ${r.hotelText ?? ''}`))) return 'departure'
  if (!noPlace) return null
  if (maxDay >= 2 && day === maxDay) return 'return'
  return 'transit'
}

function sortedDays(rows: ReadonlyArray<TravelDayRow>): TravelDayRow[] {
  return rows.filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
}

/** 처음 가는 곳: 1일차 글의 해외 도시 → 다음 날들의 첫 해외 도시 → 상품 목적지 */
export function firstDestinationCityEn(rows: ReadonlyArray<TravelDayRow>, destination?: string | null): string {
  for (const r of sortedDays(rows)) {
    const c = foreignCitiesEnInText(blob(r))
    if (c.length) return Number(r.day) === 1 ? c[c.length - 1]! : c[0]!
  }
  return destinationEn(destination)
}

/** 마지막 체류지: beforeDay 이전 날들 중 가장 늦은 날의 마지막 해외 도시 → 상품 목적지 */
export function lastStayCityEn(
  rows: ReadonlyArray<TravelDayRow>,
  beforeDay: number,
  destination?: string | null,
): string {
  const prev = sortedDays(rows).filter((r) => Number(r.day) < beforeDay).reverse()
  for (const r of prev) {
    const c = foreignCitiesEnInText(`${r.routeText ?? ''} ${r.title ?? ''} ${r.hotelText ?? ''}`)
    if (c.length) return c[c.length - 1]!
  }
  return destinationEn(destination)
}

export function travelDayTransportWord(text: string): string | null {
  if (CRUISE_RE.test(text)) return 'cruise ship'
  if (TRAIN_RE.test(text)) return 'scenic train'
  if (FLIGHT_RE.test(text)) return 'airplane view'
  return null
}

/** 사진이 빈 출국·귀국·이동일에 쓸 키워드. 해당 없음·근거 없음이면 null */
export function travelDayPhotoKeyword(
  row: TravelDayRow,
  rows: ReadonlyArray<TravelDayRow>,
  destination?: string | null,
): { kind: TravelDayKind; keyword: string } | null {
  const days = sortedDays(rows)
  const maxDay = days.reduce((m, r) => Math.max(m, Number(r.day)), 0)
  const kind = registerTravelDayKind(row, maxDay)
  if (!kind) return null
  if (kind === 'departure') {
    const city = firstDestinationCityEn(rows, destination)
    return city ? { kind, keyword: city } : null
  }
  if (kind === 'return') {
    const city = lastStayCityEn(rows, Number(row.day), destination)
    return city ? { kind, keyword: city } : null
  }
  const own = foreignCitiesEnInText(blob(row))
  const city = own.length ? own[own.length - 1]! : lastStayCityEn(rows, Number(row.day), destination)
  const mode = travelDayTransportWord(blob(row))
  if (mode) return { kind, keyword: city ? `${city} ${mode}` : mode }
  return city ? { kind, keyword: city } : null
}

/** 사진 채움 대상인 출국·귀국·이동일(키워드가 있어야 검색) */
export function registerTravelDayPhotoEligible(row: TravelDayRow, maxDay: number): boolean {
  return registerTravelDayKind(row, maxDay) !== null && String(row.imageKeyword ?? '').trim() !== ''
}

/**
 * 사진이 빈 출국·귀국·이동일의 imageKeyword 만 바꾼다. 사진이 있는 날·일반 관광일·글은 그대로.
 */
export function scheduleApplyingTravelDayKeywords(
  schedule: string | null,
  destination?: string | null,
): { json: string; changed: boolean; kinds: Record<TravelDayKind, number> } | null {
  if (!schedule?.trim()) return null
  let rows: Array<Record<string, unknown>>
  try {
    const parsed = JSON.parse(schedule) as unknown
    if (!Array.isArray(parsed)) return null
    rows = parsed as Array<Record<string, unknown>>
  } catch {
    return null
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : null)
  const view: TravelDayRow[] = rows.map((r) => ({
    day: Math.floor(Number(r.day)),
    title: str(r.title),
    routeText: str(r.routeText),
    hotelText: str(r.hotelText),
    description: str(r.description),
    imageKeyword: str(r.imageKeyword),
    imageUrl: str(r.imageUrl),
  }))
  const kinds: Record<TravelDayKind, number> = { departure: 0, return: 0, transit: 0 }
  let changed = false
  const next = rows.map((row, i) => {
    const v = view[i]!
    if (!(v.day > 0) || String(v.imageUrl ?? '').trim()) return row
    const plan = travelDayPhotoKeyword(v, view, destination)
    if (!plan) return row
    kinds[plan.kind]++
    if (String(v.imageKeyword ?? '').trim() === plan.keyword) return row
    changed = true
    return { ...row, imageKeyword: plan.keyword }
  })
  if (!changed) return { json: schedule, changed: false, kinds }
  return { json: JSON.stringify(next), changed: true, kinds }
}

/**
 * 출국·귀국·이동일 키워드가 도시 이름뿐이면(예: 'Budapest') 자동 채움 검색기는 도시만 있는 키워드를 명소로 보지 않아
 * 그 칸을 조용히 건너뛰었다. 이 날은 '그 도시의 대표 사진'이 규칙이므로 도시 대표 명소(soft-alt 사전)로 바꿔 찾는다.
 * 1일차는 국내 출발일이라 출국일로 본다(도시 이름 키워드일 때만). 같은 상품 다른 날 키워드와 겹치는 명소는 뒤로 미룬다.
 * REGRESSION-FREEZE[travel-day-city-representative-1122]: 출국·귀국일 도시 키워드 → 그 도시 대표 명소로 검색 — manifest
 */
export function travelDayRepresentativeSights(
  row: TravelDayRow,
  rows: ReadonlyArray<TravelDayRow>,
  destination: string | null | undefined,
  maxDay: number,
): { kind: TravelDayKind; city: string; sights: string[] } | null {
  const day = Number(row.day)
  const kw = String(row.imageKeyword ?? '').trim()
  const text = `${blob(row)} ${row.hotelText ?? ''}`
  let kind = registerTravelDayKind(row, maxDay)
  if (!kind && day === 1 && kw && sightProfile(kw).kind === 'city') kind = 'departure'
  // 원문 명소가 없는 도착·이동·귀국(인천-다낭-호텔, 피렌체→베네치아 이동)은 체류지 대표명소로 채운다
  if (!kind) {
    if (day === 1 && /공항|airport|출발|도착|호텔|인천|김포|김해/u.test(text)) kind = 'departure'
    else if (day === maxDay && /숙박\s*없음|귀국|공항|airport/u.test(text)) kind = 'return'
    else if (/이동/u.test(text)) kind = 'transit'
  }
  if (!kind) return null
  const planned =
    kind === 'departure'
      ? firstDestinationCityEn(rows, destination)
      : kind === 'return'
        ? lastStayCityEn(rows, day, destination)
        : ((): string => { const own = foreignCitiesEnInText(blob(row)); return own.length ? own[own.length - 1]! : destinationEn(destination) })()
  // 다른 일차 명소 키워드는 쓰지 않는다. 도시 이름 키워드만 보조.
  const kwCity = kw && sightProfile(kw).kind === 'city' ? kw : ''
  const cities = [...new Set([planned, kwCity].map((c) => String(c ?? '').trim()).filter(Boolean))]
  const otherDayProfiles = sortedDays(rows)
    .filter((r) => Number(r.day) !== day)
    .map((r) => sightProfile(String(r.imageKeyword ?? '')))
    .filter((p) => p.kind === 'sight' || p.kind === 'generic')
  for (const city of cities) {
    const allAlts = collectRegisterScheduleCitySoftAltKeywords(city).filter((a) => {
      const k = sightProfile(a).kind
      return k === 'sight' || k === 'generic'
    })
    // REGRESSION-FREEZE[travel-day-rep-city-named-1122]: 여러 도시가 섞인 묶음(하노이·시엠립)은 이 도시 이름이 든 명소만 — 하노이 귀국일에 앙코르와트 금지 — manifest
    const cityKey = city.toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').trim()
    const named = cityKey ? allAlts.filter((a) => ` ${a.toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ')} `.includes(` ${cityKey} `)) : []
    const alts = named.length > 0 ? named : allAlts
    if (alts.length === 0) continue
    const fresh = alts.filter((a) => !otherDayProfiles.some((p) => sightsOverlap(sightProfile(a), p)))
    const used = alts.filter((a) => !fresh.includes(a))
    return { kind, city, sights: [...fresh, ...used].slice(0, 3) }
  }
  return null
}

/** 공개 상품 빈 일차 채움 순서: 실패하는 상품이 앞을 막지 않게 시각마다 시작 위치를 돌린다 */
export function rotatePublicMissingDayPicks<T>(rows: T[], limit: number, now: Date): T[] {
  if (rows.length <= limit) return rows
  const hourIndex = Math.floor(now.getTime() / 3_600_000)
  const start = (hourIndex * limit) % rows.length
  return [...rows.slice(start), ...rows.slice(0, start)].slice(0, limit)
}
