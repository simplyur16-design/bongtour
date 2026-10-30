/**
 * 사진 자동 채움 뒤 '등록 완료' 자동 전환 판정 — 순수 함수(쓰기·네트워크 없음).
 * 파이프라인 05(정합성) → registered 연결. 관리자 PATCH(registered) 게이트와 같은 조건을 그대로 쓰고,
 * 사진 자동 검사(1200px·출처·iStock 신규 금지·CC BY 금지·AI 표시·도시 일치·용량)를 더한다.
 * - 가격은 '있는지'만 본다(값을 읽거나 바꾸지 않음). 공급사 원문은 건드리지 않는다.
 * - 하나라도 걸리면 registered 로 바꾸지 않고 사유만 돌려준다(사진을 지어내거나 아무 사진이나 넣지 않음).
 * REGRESSION-FREEZE[register-auto-register-gate]: 관리자 게이트 동일 + 사진 자동 검사, 실패=보류 — manifest
 */
import { isRegisterPendingPhotosReady } from '@/lib/register-pending-photos-ready'
import { verifyRegisterPrePhotoForStoredProduct } from '@/lib/register-pre-photo-verify'
import {
  evaluateImageCandidatePolicy,
  IMAGE_MIN_WIDTH,
} from '@/lib/product-image-source-policy'
import { mapDestination } from '@/lib/pexels-keyword'
// REGRESSION-FREEZE[register-day-photo-policy]: 일차 사진 도시 일치 — manifest
import { dayPhotoCityVerified } from '@/lib/register-day-photo-policy'

/** 카드에도 쓰이는 대표 사진 상한(카드 기준) */
export const AUTO_REGISTER_CARD_MAX_BYTES = 200_000
/** 상세 화면 사진(일차 사진) 상한 */
export const AUTO_REGISTER_DETAIL_MAX_BYTES = 400_000

export type ProbedImage = { url: string; bytes: number | null; width: number | null }

export type AutoRegisterGateInput = {
  registrationStatus: string | null
  listingKind: string | null
  productType: string | null
  sportsThemeTag: string[] | null
  schedule: string | null
  destination: string | null
  primaryDestination?: string | null
  title: string | null
  countryKey: string | null
  bgImageUrl: string | null
  bgImageSource: string | null
  bgImageIsGenerated: boolean | null
  bgImageAiPrompt?: string | null
  bgImagePhotographer?: string | null
  bgImageSourceUrl?: string | null
  bgImageCityName?: string | null
  bgImagePlaceName?: string | null
  bgImageRehostSearchLabel?: string | null
  departureCount: number
  itineraryDayCount: number
  /** 예약 가능 출발일의 저장된 공개 가격이 있는지(값은 받지 않음) */
  hasBookablePrice: boolean
  /** URL → 측정 결과. 없으면 '측정 안 됨'으로 보류 */
  probes: Record<string, ProbedImage | undefined>
}

export type AutoRegisterBlockReason =
  | 'status_out_of_scope'
  | 'no_departures'
  | 'no_itinerary_days'
  | 'no_bookable_price'
  | 'no_country'
  | 'verify_failed'
  | 'photo_needed'
  | 'cover_policy_failed'
  | 'cover_city_unverified'
  | 'cover_over_card_bytes'
  | 'cover_not_measured'
  | 'day_photo_policy_failed'
  | 'day_photo_low_res'
  | 'day_photo_over_detail_bytes'
  | 'day_photo_not_measured'
  | 'day_photo_city_unverified'
  | 'cover_day_duplicate'

export const AUTO_REGISTER_BLOCK_REASON_KO: Record<AutoRegisterBlockReason, string> = {
  status_out_of_scope: '등록대기 상태 아님',
  no_departures: '출발일 수집 없음',
  no_itinerary_days: '원문 일정표 없음',
  no_bookable_price: '예약 가능 출발 가격 없음',
  no_country: '국가 분류 없음',
  verify_failed: '일정·키워드 검증 실패',
  photo_needed: '사진 필요',
  cover_policy_failed: '대표 사진 기준 미달',
  cover_city_unverified: '대표 사진 도시 일치 확인 안 됨',
  cover_over_card_bytes: '대표 사진 용량 초과(카드 200,000B)',
  cover_not_measured: '대표 사진 측정 실패',
  day_photo_policy_failed: '일차 사진 출처 기준 미달',
  day_photo_low_res: '일차 사진 1200px 미만',
  day_photo_over_detail_bytes: '일차 사진 용량 초과(상세 400,000B)',
  day_photo_not_measured: '일차 사진 측정 실패',
  day_photo_city_unverified: '일차 사진 도시 일치 확인 안 됨',
  cover_day_duplicate: '대표·일차 사진 중복',
}

export type AutoRegisterGateResult = {
  ok: boolean
  reasons: AutoRegisterBlockReason[]
  detail: string[]
}

type DayRow = {
  day?: unknown
  imageUrl?: unknown
  imageManualSelected?: unknown
  imageSource?: unknown
  imageKeyword?: unknown
  title?: unknown
  description?: unknown
  routeText?: unknown
}

function parseDays(schedule: string | null): DayRow[] {
  if (!schedule) return []
  try {
    const v = JSON.parse(schedule) as unknown
    return Array.isArray(v) ? (v as DayRow[]) : []
  } catch {
    return []
  }
}

function norm(s: string | null | undefined): string {
  return String(s ?? '').toLowerCase().replace(/[\s\-_.,·]/g, '')
}

/** 대표 사진을 고른 도시·명소 이름이 상품 목적지·제목·일정에 있는지 (한글 목적지는 영문 매핑도 비교) */
export function coverCityMatchesProduct(p: AutoRegisterGateInput): boolean {
  const photoPlaces = [p.bgImageCityName, p.bgImagePlaceName, p.bgImageRehostSearchLabel]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
  if (photoPlaces.length === 0) return false
  const productText = [
    p.destination,
    p.primaryDestination,
    p.title,
    p.schedule,
    mapDestination(p.destination),
    mapDestination(p.primaryDestination ?? null),
  ]
    .map(norm)
    .join('|')
  return photoPlaces.some((place) => {
    const n = norm(place)
    if (n.length < 2) return false
    if (productText.includes(n)) return true
    // 'Da Nang Dragon Bridge' 처럼 도시+명소 → 첫 단어 묶음(도시)만으로도 비교
    const words = place.split(/\s+/).filter(Boolean)
    for (let k = words.length - 1; k >= 1; k--) {
      const head = norm(words.slice(0, k).join(' '))
      if (head.length >= 3 && productText.includes(head)) return true
    }
    return false
  })
}

function isAdminLockedCover(source: string | null): boolean {
  return /manual|admin/i.test(String(source ?? ''))
}

export function evaluateAutoRegisterGate(p: AutoRegisterGateInput): AutoRegisterGateResult {
  const reasons = new Set<AutoRegisterBlockReason>()
  const detail: string[] = []
  const st = String(p.registrationStatus ?? '').trim()
  if (st !== '' && st !== 'pending') reasons.add('status_out_of_scope')

  // 관리자 PATCH(registered)와 같은 조건
  if (p.departureCount <= 0) reasons.add('no_departures')
  if (p.itineraryDayCount <= 0) reasons.add('no_itinerary_days')
  if (!p.hasBookablePrice) reasons.add('no_bookable_price')
  if (!String(p.countryKey ?? '').trim()) reasons.add('no_country')
  const v = verifyRegisterPrePhotoForStoredProduct({
    listingKind: p.listingKind,
    productType: p.productType,
    sportsThemeTag: p.sportsThemeTag,
    schedule: p.schedule,
    destination: p.destination,
    title: p.title,
    countryKey: p.countryKey,
  } as never)
  if (!v.ok) {
    reasons.add('verify_failed')
    detail.push(...(v.issues ?? []).slice(0, 5))
  }
  if (!isRegisterPendingPhotosReady(p.bgImageUrl, p.schedule)) {
    reasons.add('photo_needed')
    return { ok: false, reasons: [...reasons], detail }
  }

  // 대표 사진
  const cover = String(p.bgImageUrl ?? '').trim()
  const coverProbe = p.probes[cover]
  const coverPolicy = evaluateImageCandidatePolicy({
    source: p.bgImageSource,
    url: cover,
    isGenerated: p.bgImageIsGenerated === true,
    prompt: p.bgImageAiPrompt ?? null,
    photographer: p.bgImagePhotographer ?? null,
    authorProfileUrl: p.bgImageSourceUrl ?? null,
    originalLink: p.bgImageSourceUrl ?? null,
    width: coverProbe?.width ?? null,
  })
  const coverLocked = isAdminLockedCover(p.bgImageSource)
  if (!coverLocked && !coverPolicy.pass) {
    reasons.add('cover_policy_failed')
    detail.push(...coverPolicy.fails.map((f) => `cover:${f}`))
  }
  if (!coverLocked && !coverCityMatchesProduct(p)) reasons.add('cover_city_unverified')
  if (!coverProbe || coverProbe.bytes == null) reasons.add('cover_not_measured')
  else if (coverProbe.bytes >= AUTO_REGISTER_CARD_MAX_BYTES) reasons.add('cover_over_card_bytes')

  // 일차 사진
  const seen = new Set<string>([cover])
  for (const d of parseDays(p.schedule)) {
    const url = String(d.imageUrl ?? '').trim()
    if (!url) continue
    if (seen.has(url)) reasons.add('cover_day_duplicate')
    seen.add(url)
    const locked = d.imageManualSelected === true
    const pr = p.probes[url]
    if (!pr || pr.bytes == null || pr.width == null) {
      reasons.add('day_photo_not_measured')
      continue
    }
    if (pr.bytes >= AUTO_REGISTER_DETAIL_MAX_BYTES) reasons.add('day_photo_over_detail_bytes')
    if (locked) continue
    if (pr.width < IMAGE_MIN_WIDTH) reasons.add('day_photo_low_res')
    const src =
      d.imageSource && typeof d.imageSource === 'object'
        ? (d.imageSource as Record<string, unknown>)
        : {}
    const pol = evaluateImageCandidatePolicy({
      source: typeof src.source === 'string' ? src.source : null,
      url,
      license: typeof src.license === 'string' ? src.license : null,
      isGenerated: src.isGenerated === true || /gemini|generated/i.test(String(src.source ?? '')),
      prompt: typeof src.prompt === 'string' ? src.prompt : null,
      photographer: typeof src.photographer === 'string' ? src.photographer : null,
      authorProfileUrl: typeof src.originalLink === 'string' ? src.originalLink : null,
      originalLink: typeof src.originalLink === 'string' ? src.originalLink : null,
      width: pr.width,
    })
    if (!pol.pass) {
      reasons.add('day_photo_policy_failed')
      detail.push(...pol.fails.map((f) => `day${String(d.day ?? '?')}:${f}`))
    }
    if (!dayPhotoCityVerified(d, { destination: p.destination, title: p.title })) {
      reasons.add('day_photo_city_unverified')
      detail.push(`day${String(d.day ?? '?')}:city`)
    }
  }
  return { ok: reasons.size === 0, reasons: [...reasons], detail }
}

/** 관리자 화면용 한 줄 사유 */
export function formatAutoRegisterBlockReasons(reasons: readonly AutoRegisterBlockReason[]): string {
  return reasons.map((r) => AUTO_REGISTER_BLOCK_REASON_KO[r] ?? r).join(', ')
}
