/**
 * modetour(모두투어) 등록 — GetScheduleList register-facts → RegisterScheduleDay SSOT.
 * B2C API(placeHeader·scheduleHotel·ortherActions) 전용. 공급사 공용 모듈로 합치지 않는다.
 *
 * REGRESSION-FREEZE[modetour-register-api-schedule]: modetourFactDaysToRegisterSchedule — manifest
 */
import { classifyModetourScheduleCardDayKind } from '@/lib/modetour-schedule-image-keyword'
import { parseFactMealsListToScheduleFields } from '@/lib/register-schedule-meal-parse'
import {
  filterRegisterScheduleRoutePlaceSegments,
  isRegisterScheduleRoutePlaceNoise,
  sanitizeRegisterScheduleRouteText,
} from '@/lib/register-schedule-route-place-noise'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-modetour'

const MODETOUR_SCHEDULE_HIGHLIGHT_MAX = 7

const MODETOUR_HIGHLIGHT_NOISE_RE =
  /출발\s*전\s*준비|준비\s*사항|변동이\s*있을\s*경우|홈페이지|이메일|알림톡|기내박|총\s*\d+\s*개의\s*예정\s*호텔|확정\s*되는대로|출발\s*\d+\s*시간\s*전|수하물|탑승권|터미널|연결\s*수속|입국신고|사전\s*입국|온라인\s*입국|입국\s*유의|등록\s*방법|작성\s*(?:안내|요령)|패키지\s*개별\s*일정|개별\s*일정\s*불가|현지\s*미팅|미팅\s*안내|안내\s*사항|유의\s*사항|QR\s*코드|이민국\s*신청|대행으로\s*진행|모바일\s*.*입국/i

const MODETOUR_PLACEHOLDER_HOTEL_RE =
  /총\s*\d+\s*개의\s*예정\s*호텔|확정\s*되는대로|변동이\s*있을\s*경우|홈페이지|이메일|알림톡/i

function stripScheduleLabel(name: string): string {
  return name.replace(/^[\s▶■◎●#]+/, '').replace(/\s+/g, ' ').trim()
}

function stripModetourInlineHtml(s: string): string {
  return String(s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanModetourHighlightLabel(label: string): string {
  return stripScheduleLabel(stripModetourInlineHtml(label))
}

function normalizeModetourHighlightKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '')
}

function isModetourHighlightNoise(label: string): boolean {
  const t = cleanModetourHighlightLabel(label)
  if (!t || t.length < 2) return true
  if (MODETOUR_HIGHLIGHT_NOISE_RE.test(t)) return true
  if (/^[\d\s▶\-–—.;]+$/.test(t)) return true
  if (t.length > 48) return true
  return false
}

/** `입국 도시(상해-푸동)` → `상해` — admin 괄호에서 입국 도시만 추출 */
function extractModetourEntryCityFromLabel(label: string): string | null {
  const m = label.match(/입국\s*도시\s*\(([^)]+)\)/i)
  if (!m?.[1]) return null
  const city = m[1]
    .split(/[-–—,/·]/)
    .map((s) => s.trim())
    .find((s) => s.length >= 2)
  if (!city || isModetourHighlightNoise(city)) return null
  return city
}

/** fact place 한 줄 — 준비·입국신고·미팅 안내 제거, 입국 도시 괄호는 도시명만. */
export function normalizeModetourFactPlaceLabel(raw: string): string | null {
  const label = cleanModetourHighlightLabel(String(raw ?? ''))
  if (!label) return null
  if (isRegisterScheduleRoutePlaceNoise(label)) return null
  const entryCity = extractModetourEntryCityFromLabel(label)
  if (entryCity) return entryCity
  if (isModetourHighlightNoise(label)) return null
  return label
}

/** fact places — 준비·안내·HTML 잡음 제거. routeText·하이라이트 SSOT. */
export function dedupeModetourFactDayPlaces(places: string[]): string[] {
  const out: string[] = []
  const keys: string[] = []
  for (const raw of places) {
    const label = normalizeModetourFactPlaceLabel(String(raw ?? ''))
    if (!label) continue
    const key = normalizeModetourHighlightKey(label)
    if (!key) continue
    const dupIdx = keys.findIndex(
      (k) => k === key || (k.length >= 4 && key.includes(k)) || (key.length >= 4 && k.includes(key)),
    )
    if (dupIdx >= 0) {
      if (label.length > out[dupIdx]!.length) out[dupIdx] = label
      continue
    }
    keys.push(key)
    out.push(label)
  }
  return out
}

function scoreModetourHighlight(label: string): number {
  const t = cleanModetourHighlightLabel(label)
  if (t.length < 3) return -10
  if (/스피드\s*보트|보트\s*이동|공항\s*이동/i.test(t)) return 3
  if (/^몰디브$|^인천$|^싱가포르$/i.test(t)) return 1
  if (t.length <= 36) return 6
  return 4
}

/** 일정 title — 핵심 장면·장소 최대 7개. */
export function selectModetourScheduleHighlights(
  places: string[],
  max = MODETOUR_SCHEDULE_HIGHLIGHT_MAX,
): string[] {
  const deduped = dedupeModetourFactDayPlaces(places)
  return [...deduped]
    .map((label, idx) => ({ label, idx, score: scoreModetourHighlight(label) }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .slice(0, max)
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.label)
}

type ModetourScheduleVibeProfile =
  | 'resort_leisure'
  | 'island_transfer'
  | 'return_transit'
  | 'return_calm'
  | 'arrival'
  | 'generic_tourism'

const MODETOUR_SCHEDULE_VIBE_DESCRIPTIONS: Record<ModetourScheduleVibeProfile, readonly string[]> = {
  resort_leisure: [
    '몰디브의 에메랄드 바다와 리조트에서 여유롭게 쉬어 가는, 휴양 중심의 하루입니다.',
    '특별한 이동 없이 섬 안에서 휴식과 자유 시간을 즐기기 좋은 구성입니다.',
  ],
  island_transfer: [
    '스피드보트로 섬과 리조트를 잇는, 바다 위 이동이 포인트인 하루입니다.',
    '짧은 항해 뒤 리조트에 도착하며, 휴양지 분위기를 본격적으로 느끼기 시작합니다.',
  ],
  return_transit: [
    '리조트를 정리하고 공항·경유지를 거쳐 귀국길로 이어지는, 이동 중심의 마무리 일정입니다.',
    '여행의 리듬을 늦추지 않고, 돌아오는 길까지 자연스럽게 이어지는 흐름입니다.',
  ],
  return_calm: [
    '여유로운 마무리 뒤 귀국 동선으로, 여정의 여운을 정리하는 하루입니다.',
    '별도의 굵직한 관광 없이, 핵심 분위기만 가볍게 담아가며 여행을 마무리합니다.',
  ],
  arrival: [
    '출발·경유를 거쳐 목적지에 도착하는, 여행의 문을 여는 입국·이동 일정입니다.',
    '공항과 이동 동선을 따라, 앞으로 펼쳐질 휴양 일정을 기대하게 하는 구성입니다.',
  ],
  generic_tourism: [
    '하루 동안 여러 장면이 자연스럽게 이어지는, 보기와 이동이 균형 잡힌 알찬 동선입니다.',
    '특정 장소 나열보다 전체적인 흐름과 분위기를 중심으로 여행의 컨셉을 느끼기 좋은 일정입니다.',
  ],
}

function inferModetourScheduleVibeProfile(
  day: RegisterFactScheduleDay,
  maxDay: number,
  joinedBlob: string,
): ModetourScheduleVibeProfile {
  const kind = classifyModetourScheduleCardDayKind(day.day, maxDay, joinedBlob)
  if (kind === 'return_home') {
    if (/싱가포르|경유|스피드\s*보트|공항/i.test(joinedBlob)) return 'return_transit'
    return 'return_calm'
  }
  if (kind === 'movement' && day.day === 1) return 'arrival'
  if (day.day === 1 && isModetourDay1DomesticHubToForeignDestination(joinedBlob)) return 'arrival'
  if (/스피드\s*보트|보트\s*이동|공항\s*↔|리조트\s*입장/i.test(joinedBlob)) return 'island_transfer'
  if (/몰디브|Maldives|리조트|비치\s*빌라|조이아/i.test(joinedBlob) && day.day > 1 && day.day < maxDay) {
    return 'resort_leisure'
  }
  return 'generic_tourism'
}

/** 1일차 국내 허브 → 해외 목적지 (입국신고 안내 제거 후에도 arrival 요약 유지) */
function isModetourDay1DomesticHubToForeignDestination(joinedBlob: string): boolean {
  return (
    /(?:인천|김포|부산|청주|대구|ICN|GMP|PUS|TAE|CJJ)(?:\s|$|-)/u.test(joinedBlob) &&
    /(?:상해|Shanghai|북경|Beijing|방콕|Bangkok|다낭|Da\s*Nang|홍콩|Hong\s*Kong|타이페이|Taipei|도쿄|Tokyo|오사카|Osaka|연길|YNJ|싱가포르|Singapore|발리|Bali|푸켓|Phuket|세부|Cebu|호치민|Hanoi|하노이|쿠알라룸푸르)/i.test(
      joinedBlob,
    )
  )
}

function modetourHighlightLeakChunks(label: string): string[] {
  const bare = label.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
  const chunks = bare
    .split(/[,，·]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
  return [...new Set([bare, ...chunks].filter((s) => s.length >= 4))]
}

/** API 일정 description — 장소 나열 없이 분위기·흐름 2~3문장. */
export function composeModetourScheduleVibeDescription(
  day: RegisterFactScheduleDay,
  maxDay: number,
  highlights: string[],
): string {
  const chainBlob = highlights.join(' - ')
  const transport = stripModetourInlineHtml(String(day.transportNote ?? ''))
  const joined = [transport, chainBlob, ...dedupeModetourFactDayPlaces(day.places)].filter(Boolean).join(' ')
  const profile = inferModetourScheduleVibeProfile(day, maxDay, joined)
  const sentences = [...MODETOUR_SCHEDULE_VIBE_DESCRIPTIONS[profile]].slice(0, 3)
  let desc = sentences.join(' ')
  for (const h of highlights) {
    for (const chunk of modetourHighlightLeakChunks(h)) {
      if (desc.includes(chunk)) {
        desc = MODETOUR_SCHEDULE_VIBE_DESCRIPTIONS.generic_tourism.slice(0, 2).join(' ')
        break
      }
    }
  }
  return desc.slice(0, 320).trim()
}

/** 상품명에서 리조트·숙소 힌트 (예: 조이아일랜드 비치빌라). */
export function extractModetourResortHintFromProductTitle(title: string | null | undefined): string | null {
  const t = String(title ?? '').trim()
  if (!t) return null
  const m = t.match(
    /(?:몰디브|Maldives|푸켓|Phuket|괌|Guam|사이판|Saipan|발리|Bali|코타\s*키나발루|세부|Cebu)[^\d<]{0,24}?(?:리조트|resort|비치\s*빌라|beach\s*villa|조이아[^\d<]{2,24}|villa)/i,
  )
  if (m?.[0]) return m[0].replace(/\s+/g, ' ').trim().slice(0, 48)
  const bracket = t.match(/<([^>]{4,40})>/)?.[1]?.trim()
  if (bracket && !/AI|스피드|보트/i.test(bracket)) return bracket.slice(0, 48)
  return null
}

export function normalizeModetourScheduleHotelText(
  raw: string | null | undefined,
  opts?: { productTitle?: string | null },
): string | null {
  const t = stripScheduleLabel(stripModetourInlineHtml(String(raw ?? '')))
  if (!t) return null
  if (/기내박/.test(t)) return '기내박'
  if (MODETOUR_PLACEHOLDER_HOTEL_RE.test(t)) {
    const hint = extractModetourResortHintFromProductTitle(opts?.productTitle)
    return hint ? `${hint}(출발 전 확정)` : '예정 호텔(출발 전 확정)'
  }
  return t.slice(0, 200)
}

export type ModetourFactDaysToRegisterScheduleOpts = {
  productTitle?: string | null
  /** 항공+호텔(자유여행) — routeText·식사·숙소만, description/imageKeyword는 Fit SSOT */
  registerAirHotelFree?: boolean
}

/** register-facts scheduleDays → RegisterParsed.schedule SSOT */
export function modetourFactDaysToRegisterSchedule(
  days: RegisterFactScheduleDay[],
  opts?: ModetourFactDaysToRegisterScheduleOpts,
): RegisterScheduleDay[] {
  const maxDay = days.reduce((m, d) => Math.max(m, d.day), 0)
  return days.map((d) => {
    const places = dedupeModetourFactDayPlaces(d.places)
    const highlights = selectModetourScheduleHighlights(d.places)
    const firstTransport =
      stripModetourInlineHtml(String(d.transportNote ?? ''))
        .split(';')
        .map((s) => s.trim())
        .find(Boolean) ?? ''
    const title =
      (highlights.length > 0 ? highlights.join(' - ') : '') ||
      firstTransport ||
      normalizeModetourScheduleHotelText(d.hotels[0], opts) ||
      `${d.day}일차`
    const description = opts?.registerAirHotelFree
      ? ''
      : composeModetourScheduleVibeDescription(d, maxDay, highlights) || title
    const routeText =
      places.length > 0
        ? places.join(' - ')
        : firstTransport.includes(' - ')
          ? firstTransport
          : null
    const hotelText =
      d.hotels
        .map((h) => normalizeModetourScheduleHotelText(h, opts))
        .filter(Boolean)
        .join(' / ') || null
    const meals = parseFactMealsListToScheduleFields(d.meals)
    return {
      day: d.day,
      title,
      description,
      routeText,
      imageKeyword: '',
      hotelText,
      breakfastText: meals.breakfastText ?? null,
      lunchText: meals.lunchText ?? null,
      dinnerText: meals.dinnerText ?? null,
      mealSummaryText: meals.mealSummaryText ?? null,
    }
  })
}

/** 등록 schedule[] — routeText 행정·UI 세그먼트 제거 (기수집·붙여넣기 병합 후) */
export function sanitizeModetourRegisterScheduleRouteRows<
  T extends { day: number; routeText?: string | null; title?: string | null },
>(rows: T[]): T[] {
  return rows.map((row) => {
    const routeText = sanitizeRegisterScheduleRouteText(row.routeText, MODETOUR_SCHEDULE_HIGHLIGHT_MAX)
    const titlePlaces = filterRegisterScheduleRoutePlaceSegments(
      String(row.title ?? '')
        .split(/\s*-\s*/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
    const title =
      titlePlaces.length > 0
        ? titlePlaces.slice(0, MODETOUR_SCHEDULE_HIGHLIGHT_MAX).join(' - ')
        : row.title
    return { ...row, routeText, title }
  })
}
