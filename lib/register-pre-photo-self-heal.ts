/**
 * 등록 사진 수급 전 — 깨진 키워드를 비우고 등록 SSOT로 다시 채운다. 사진 생성 없음.
 * 그래도 검증 실패면 등록대기에 올리지 않는다.
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: 파라도르·식사 키워드 제거, 사진 생성 없음 — manifest
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 패키지·테마만 랜드마크 재적용, 자유여행은 패키지 파이프 금지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: 검색 시드 geo · 공급사당 3건 — manifest
 * REGRESSION-FREEZE[register-pre-photo-parser-fix]: 셀프힐이 SSOT로 재채움, 통과만 등록대기 — manifest
 * REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 제목 자유일정만 추천일정 — FIT·환승 제외 — manifest
 * REGRESSION-FREEZE[register-pre-photo-heal-keep-filled-keywords]: 유효 랜드마크는 덮어쓰지 않음 — manifest
 * REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: apply 방문도시·kw2 승격은 힐이 지우지 않음 — manifest
 * REGRESSION-FREEZE[register-hk-gogung-not-taipei-npm]: 나라 틀린 키워드는 비우고 SSOT 재적용 — manifest
 * REGRESSION-FREEZE[register-pre-photo-verify-heal-off-trip-keyword]: FIT drop + 당일 route 재채움 — manifest
 * REGRESSION-FREEZE[register-pre-photo-verify-identity-country-landmark]: FIT 요약·같은 날 나라 혼선 — manifest
 * REGRESSION-FREEZE[register-schedule-description-no-repeated-closer]: 트립 템플릿 closer 재합성 — manifest
 * REGRESSION-FREEZE[register-pre-photo-keyword-own-route]: 당일 route 밖 키워드는 지우고 그날 동선으로 채움 — manifest
 */
import { composeRegisterScheduleDaySummary } from '@/lib/register-schedule-description-characteristic-ssot'
import {
  englishFromScheduleKoreanSegment,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import { isBareCityOrCountryKeyword, isHotelLodgingImageKeyword } from '@/lib/pexels-place-name-keyword'
import { tryPersistScheduleImageKeyword } from '@/lib/schedule-image-keyword-persist'
import {
  firstMatchingScheduleCityEn,
  firstMatchingScheduleSpotEn,
} from '@/lib/schedule-poi-regex-ssot'
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import type { RegisterAdminLane } from '@/lib/register-admin-lane'
import {
  hasRegisterFreeDayRecommendedItinerary,
  isRegisterPendingFreeItineraryDay,
  registerScheduleKeywordMatchesOwnDayRoute,
  routeTextHasIdentifiableVisitPlace,
} from '@/lib/register-pre-photo-verify'
import {
  isBrokenRegisterLandmarkKeyword,
  isBrokenRegisterScheduleDescription,
  tripDaysSharingTemplateCloser,
  type RegisterPrePhotoHealRow,
} from '@/lib/register-pre-photo-guards'
import {
  isRegisterScheduleCrossContinentHallucinationKeyword,
  isRegisterScheduleSameDayKeywordCountryClash,
  registerPrePhotoPlaceDestHay,
} from '@/lib/register-schedule-cross-continent-keyword-guard'

export { REGISTER_PRE_PHOTO_INGEST_PER_GEO, REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER } from '@/lib/register-pre-photo-ingest-geo-slots'
export {
  isBrokenRegisterLandmarkKeyword,
  isBrokenRegisterScheduleDescription,
  type RegisterPrePhotoHealRow,
} from '@/lib/register-pre-photo-guards'

export const REGISTER_PRE_PHOTO_OPERATOR_SUPPLIERS = [
  'hanatour',
  'modetour',
  'verygoodtour',
  'ybtour',
] as const

export type RegisterPrePhotoHealOpts = {
  supplierKey: string
  productDestination?: string | null
  productTitle?: string | null
  /** 등록화면 레인. 자유여행은 패키지 POI·요약 재작성 금지. 기본 패키지. */
  lane?: RegisterAdminLane
}

export type RegisterPrePhotoHealNote = {
  day: number
  field: 'imageKeyword' | 'imageKeyword2' | 'description' | 'imageUrl'
  reason: string
}

export type RegisterPrePhotoHealResult<T extends RegisterPrePhotoHealRow> = {
  rows: T[]
  notes: RegisterPrePhotoHealNote[]
  reappliedKeywords: boolean
}

function sanitizeLandmarkKeyword(
  raw: string | null | undefined,
  allowHotelLodging = false,
): string {
  const t = String(raw ?? '').trim()
  if (!t || isBrokenRegisterLandmarkKeyword(t, { allowHotelLodging })) return ''
  if (allowHotelLodging && isHotelLodgingImageKeyword(t)) return t
  const persist = tryPersistScheduleImageKeyword(t)
  return persist.ok ? persist.value : ''
}

function refillFitKeywordFromDayRoute(
  row: RegisterPrePhotoHealRow,
  destHay: string,
  trip: readonly RegisterPrePhotoHealRow[],
): string {
  for (const seg of splitRouteTextPlaceSegments(row.routeText)) {
    const en = englishFromScheduleKoreanSegment(seg) || seg
    const persist = tryPersistScheduleImageKeyword(en)
    if (!persist.ok) continue
    const v = persist.value
    if (!v || isBrokenRegisterLandmarkKeyword(v, { allowHotelLodging: true })) continue
    if (destHay && isRegisterScheduleCrossContinentHallucinationKeyword(v, destHay, trip)) continue
    return v
  }
  return ''
}

function scheduleHasBrokenKeywords(
  rows: readonly RegisterPrePhotoHealRow[],
  opts?: {
    allowHotelLodging?: boolean
    productTitle?: string | null
    requireFreeDayRecommended?: boolean
  },
): boolean {
  const allowHotelLodging = opts?.allowHotelLodging ?? false
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return false
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  for (const row of days) {
    if (isBrokenRegisterLandmarkKeyword(row.imageKeyword, { allowHotelLodging })) return true
    if (isBrokenRegisterLandmarkKeyword(row.imageKeyword2, { allowHotelLodging })) return true
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot === 'middle' && !String(row.imageKeyword ?? '').trim()) {
      return true
    }
    if (
      slot === 'middle' &&
      String(row.imageKeyword ?? '').trim() &&
      !registerScheduleKeywordMatchesOwnDayRoute(row.routeText, row.imageKeyword)
    ) {
      return true
    }
    if (
      opts?.requireFreeDayRecommended &&
      slot === 'middle' &&
      isRegisterPendingFreeItineraryDay(row, { productTitle: opts.productTitle }) &&
      !hasRegisterFreeDayRecommendedItinerary(row)
    ) {
      return true
    }
    const a = String(row.imageKeyword ?? '').trim().toLowerCase()
    const b = String(row.imageKeyword2 ?? '').trim().toLowerCase()
    if (a && b && a === b) return true
  }
  // 중간일끼리 같은 명소 반복(호텔일에 Grand World 복사)은 재적용 대상
  const seenMiddle = new Set<string>()
  for (const row of days) {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot !== 'middle') continue
    const kw = String(row.imageKeyword ?? '').trim()
    const key = kw.toLowerCase()
    if (!key || isBareCityOrCountryKeyword(kw)) continue
    if (seenMiddle.has(key)) return true
    seenMiddle.add(key)
  }
  return false
}

function refillEmptyMiddleKeywordFromRoute<T extends RegisterPrePhotoHealRow>(
  rows: T[],
  destHay: string,
): T[] {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  return rows.map((row) => {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot !== 'middle' || String(row.imageKeyword ?? '').trim()) return row
    const hay = [row.routeText, row.title].filter(Boolean).join(' ')
    const candidates = [firstMatchingScheduleSpotEn(hay), firstMatchingScheduleCityEn(hay)].filter(
      (v): v is string => Boolean(v && String(v).trim()),
    )
    for (const raw of candidates) {
      const persist = tryPersistScheduleImageKeyword(raw)
      if (!persist.ok || !persist.value) continue
      if (isBrokenRegisterLandmarkKeyword(persist.value) && !isBareCityOrCountryKeyword(persist.value)) {
        continue
      }
      if (destHay && isRegisterScheduleCrossContinentHallucinationKeyword(persist.value, destHay, rows)) {
        continue
      }
      return { ...row, imageKeyword: persist.value }
    }
    return row
  })
}

function dropKeywordsNotOnOwnDayRoute<T extends RegisterPrePhotoHealRow>(rows: T[]): T[] {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  return rows.map((row) => {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot !== 'middle') return row
    if (!routeTextHasIdentifiableVisitPlace(row.routeText)) return row
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    const keepKw = !kw || registerScheduleKeywordMatchesOwnDayRoute(row.routeText, kw)
    const keepKw2 = !kw2 || registerScheduleKeywordMatchesOwnDayRoute(row.routeText, kw2)
    if (keepKw && keepKw2) return row
    let nextKw = keepKw ? kw : ''
    let nextKw2 = keepKw2 ? kw2 || null : null
    if (!nextKw && nextKw2) {
      nextKw = nextKw2
      nextKw2 = null
    }
    return { ...row, imageKeyword: nextKw, imageKeyword2: nextKw2 }
  })
}

function promoteEmptyMiddlePrimaryFromKeyword2<T extends RegisterPrePhotoHealRow>(rows: T[]): T[] {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  return rows.map((row) => {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    if (slot !== 'middle' || kw || !kw2) return row
    return { ...row, imageKeyword: kw2, imageKeyword2: null }
  })
}

function healDescription(row: RegisterPrePhotoHealRow, maxDay: number, force = false): string {
  const current = String(row.description ?? '').trim()
  if (!force && !isBrokenRegisterScheduleDescription(current, row.routeText)) return current
  const routePlaces = splitRouteTextPlaceSegments(row.routeText)
  try {
    return composeRegisterScheduleDaySummary({
      day: Number(row.day) || 1,
      maxDay,
      routePlaces,
      joinedBlob: [row.routeText, row.title, row.description].filter(Boolean).join('\n'),
      supplierText: null,
    })
  } catch {
    return current
  }
}

/**
 * 사진 생성·Pexels/Gemini 호출 없음.
 * 숙소·식사 키워드를 비운 뒤, 중간일이 비거나 깨져 있으면 등록 imageKeyword SSOT로 다시 채운다.
 * 이미 유효한 랜드마크는 덮어쓰지 않는다.
 * 그래도 깨져 있으면 parser_fix_required — 그 건은 등록대기에 올리지 않는다.
 */
export function healRegisterPrePhotoSchedule<T extends RegisterPrePhotoHealRow>(
  rows: T[],
  opts: RegisterPrePhotoHealOpts,
): RegisterPrePhotoHealResult<T> {
  const notes: RegisterPrePhotoHealNote[] = []
  if (!rows.length) return { rows, notes, reappliedKeywords: false }
  const lane: RegisterAdminLane = opts.lane ?? 'package'
  const isFit = lane === 'air_hotel_free'

  let working: T[] = rows.map((row) => {
    const kw = sanitizeLandmarkKeyword(row.imageKeyword, isFit)
    const kw2 = sanitizeLandmarkKeyword(row.imageKeyword2, isFit)
    if (String(row.imageKeyword ?? '').trim() && !kw) {
      notes.push({ day: Number(row.day), field: 'imageKeyword', reason: 'lodging_or_non_landmark' })
    }
    if (String(row.imageKeyword2 ?? '').trim() && !kw2) {
      notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'lodging_or_non_landmark' })
    }
    return {
      ...row,
      imageKeyword: kw,
      imageKeyword2: kw2 || null,
    }
  })

  const destHay = registerPrePhotoPlaceDestHay(opts.productDestination, opts.productTitle)
  if (destHay) {
    working = working.map((row) => {
      const kw = String(row.imageKeyword ?? '').trim()
      const kw2 = String(row.imageKeyword2 ?? '').trim()
      const dropKw = Boolean(
        kw && isRegisterScheduleCrossContinentHallucinationKeyword(kw, destHay, working),
      )
      const dropKw2 = Boolean(
        kw2 && isRegisterScheduleCrossContinentHallucinationKeyword(kw2, destHay, working),
      )
      if (dropKw) notes.push({ day: Number(row.day), field: 'imageKeyword', reason: 'wrong_country' })
      if (dropKw2) notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'wrong_country' })
      return {
        ...row,
        imageKeyword: dropKw ? '' : row.imageKeyword,
        imageKeyword2: dropKw2 ? null : row.imageKeyword2,
      }
    })
  }

  working = working.map((row) => {
    if (!isRegisterScheduleSameDayKeywordCountryClash(row.imageKeyword, row.imageKeyword2)) return row
    notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'same_day_country_clash' })
    return { ...row, imageKeyword2: null }
  })

  let reappliedKeywords = false
  if (isFit) {
    const maxFitDay = Math.max(...working.map((r) => Number(r.day)).filter((d) => d > 0), 1)
    const activeFit = working.filter((r) => Number(r.day) > 0).length
    working = working.map((row) => {
      const day = Number(row.day)
      const slot = resolveScheduleKeywordSlotKind(day, maxFitDay, activeFit)
      if (slot !== 'middle') return row
      if (String(row.imageKeyword ?? '').trim()) return row
      const filled = refillFitKeywordFromDayRoute(row, destHay, working)
      if (!filled) return row
      notes.push({ day, field: 'imageKeyword', reason: 'fit_route_refill' })
      reappliedKeywords = true
      return { ...row, imageKeyword: filled }
    })
    working = working.map((row) => {
      if (!isRegisterScheduleSameDayKeywordCountryClash(row.imageKeyword, row.imageKeyword2)) return row
      notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'same_day_country_clash' })
      return { ...row, imageKeyword2: null }
    })
    // REGRESSION-FREEZE[register-pre-photo-keyword-own-route]: FIT도 당일 route 밖 키워드 제거 — manifest
    working = dropKeywordsNotOnOwnDayRoute(working)
    working = refillEmptyMiddleKeywordFromRoute(working, destHay)
    const maxFitDesc = Math.max(...working.map((r) => Number(r.day)).filter((d) => d > 0), 1)
    const fitRepeatedCloser = tripDaysSharingTemplateCloser(working)
    working = working.map((row) => {
      const before = String(row.description ?? '').trim()
      const force = fitRepeatedCloser.has(Number(row.day))
      const description = healDescription(row, maxFitDesc, force)
      if (description !== before) {
        notes.push({
          day: Number(row.day),
          field: 'description',
          reason: force ? 'repeated_closer_resynth' : 'filler_or_duplicate_resynth',
        })
      }
      return { ...row, description }
    })
    // if (scheduleHasBrokenKeywords(working)) — FIT도 깨진 키워드면 parser_fix
    if (scheduleHasBrokenKeywords(working, { allowHotelLodging: true })) {
      notes.push({ day: 0, field: 'imageKeyword', reason: 'parser_fix_required' })
    }
    return { rows: working, notes, reappliedKeywords }
  }

  // REGRESSION-FREEZE[register-pre-photo-heal-keep-filled-keywords]: 깨진/빈 중간일만 SSOT 재적용 — manifest
  if (
    scheduleHasBrokenKeywords(working, {
      productTitle: opts.productTitle,
      requireFreeDayRecommended: true,
    })
  ) {
    const applied = applyRegisterScheduleImageKeywordsBySupplier(
      working.map((row) => ({
        day: Number(row.day) || 0,
        title: row.title != null ? String(row.title) : undefined,
        description: row.description != null ? String(row.description) : undefined,
        routeText: row.routeText ?? null,
        imageKeyword: row.imageKeyword ?? '',
        imageKeyword2: row.imageKeyword2 ?? null,
      })),
      {
        supplierKey: opts.supplierKey,
        productDestination: opts.productDestination,
        productTitle: opts.productTitle,
        travelScope: 'package',
      },
    )
    reappliedKeywords = true
    const byDay = new Map(applied.map((r) => [Number(r.day), r]))
    working = working.map((row) => {
      const a = byDay.get(Number(row.day))
      if (!a) return row
      return {
        ...row,
        imageKeyword: sanitizeLandmarkKeyword(a.imageKeyword),
        imageKeyword2: sanitizeLandmarkKeyword(a.imageKeyword2) || null,
      }
    })
    if (destHay) {
      working = working.map((row) => {
        const kw = String(row.imageKeyword ?? '').trim()
        const kw2 = String(row.imageKeyword2 ?? '').trim()
        const dropKw = Boolean(
          kw && isRegisterScheduleCrossContinentHallucinationKeyword(kw, destHay, working),
        )
        const dropKw2 = Boolean(
          kw2 && isRegisterScheduleCrossContinentHallucinationKeyword(kw2, destHay, working),
        )
        if (dropKw) notes.push({ day: Number(row.day), field: 'imageKeyword', reason: 'wrong_country' })
        if (dropKw2) notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'wrong_country' })
        return {
          ...row,
          imageKeyword: dropKw ? '' : row.imageKeyword,
          imageKeyword2: dropKw2 ? null : row.imageKeyword2,
        }
      })
    }
    working = working.map((row) => {
      if (!isRegisterScheduleSameDayKeywordCountryClash(row.imageKeyword, row.imageKeyword2)) return row
      notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'same_day_country_clash' })
      return { ...row, imageKeyword2: null }
    })
  }

  // REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: 중간일 primary 공란·kw2 있으면 승격 — manifest
  // REGRESSION-FREEZE[register-pre-photo-keyword-own-route]: apply 트립 블리드를 당일 route로 되돌림 — manifest
  working = promoteEmptyMiddlePrimaryFromKeyword2(working)
  working = dropKeywordsNotOnOwnDayRoute(working)
  working = refillEmptyMiddleKeywordFromRoute(working, destHay)

  if (
    scheduleHasBrokenKeywords(working, {
      productTitle: opts.productTitle,
      requireFreeDayRecommended: true,
    })
  ) {
    notes.push({ day: 0, field: 'imageKeyword', reason: 'parser_fix_required' })
  }

  const maxDay = Math.max(...working.map((r) => Number(r.day)).filter((d) => d > 0), 1)
  // REGRESSION-FREEZE[register-schedule-description-no-repeated-closer]: 같은 closer 일차 강제 재합성 — manifest
  const repeatedCloserDays = tripDaysSharingTemplateCloser(working)
  working = working.map((row) => {
    const before = String(row.description ?? '').trim()
    const force = repeatedCloserDays.has(Number(row.day))
    const description = healDescription(row, maxDay, force)
    if (description !== before) {
      notes.push({
        day: Number(row.day),
        field: 'description',
        reason: force ? 'repeated_closer_resynth' : 'filler_or_duplicate_resynth',
      })
    }
    return { ...row, description }
  })

  return { rows: working, notes, reappliedKeywords }
}

const OBVIOUS_BROKEN_URL_RE = /^(?:undefined|null|n\/a|#)$/i

/** 네트워크 HEAD 없이 형식만. 404 검사는 probeRegisterScheduleImageUrl. */
export function isObviouslyBrokenScheduleImageUrl(url: string | null | undefined): boolean {
  const t = String(url ?? '').trim()
  if (!t) return false
  if (OBVIOUS_BROKEN_URL_RE.test(t)) return true
  if (/^(?:javascript:|data:)/i.test(t)) return true
  if (!/^https?:\/\//i.test(t)) return true
  return false
}

export async function probeRegisterScheduleImageUrl(
  url: string | null | undefined,
  timeoutMs = 2500,
): Promise<'ok' | 'broken' | 'empty'> {
  const t = String(url ?? '').trim()
  if (!t) return 'empty'
  if (isObviouslyBrokenScheduleImageUrl(t)) return 'broken'
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(t, { method: 'HEAD', redirect: 'follow', signal: ac.signal })
    if (res.status === 404 || res.status === 410 || res.status >= 500) return 'broken'
    if (res.ok || res.status === 405 || res.status === 403) return 'ok'
    const getRes = await fetch(t, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: { Range: 'bytes=0-0' },
    })
    if (getRes.status === 404 || getRes.status === 410) return 'broken'
    return getRes.ok ? 'ok' : 'broken'
  } catch {
    return 'broken'
  } finally {
    clearTimeout(timer)
  }
}
