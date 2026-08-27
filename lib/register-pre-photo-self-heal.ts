/**
 * 등록 사진 수급 전 — 숙소·식사 키워드는 비우고 파서/POI로 고친다. 재채움 금지.
 * 검증 실패·파서 수정 필요는 등록대기에 올리지 않는다.
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: 파라도르·식사 키워드 제거, 사진 생성 없음 — manifest
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 패키지·테마만 랜드마크 재적용, 자유여행은 패키지 파이프 금지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: 1/country-or-city — manifest
 * REGRESSION-FREEZE[register-pre-photo-parser-fix]: 빈칸·블리드 재채움 금지, 검증 통과만 등록대기 — manifest
 */
import { composeRegisterScheduleDaySummary } from '@/lib/register-schedule-description-characteristic-ssot'
import { splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { tryPersistScheduleImageKeyword } from '@/lib/schedule-image-keyword-persist'
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import type { RegisterAdminLane } from '@/lib/register-admin-lane'
import {
  isBrokenRegisterLandmarkKeyword,
  isBrokenRegisterScheduleDescription,
  type RegisterPrePhotoHealRow,
} from '@/lib/register-pre-photo-guards'

export { REGISTER_PRE_PHOTO_INGEST_PER_GEO } from '@/lib/register-pre-photo-ingest-geo-slots'
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

function sanitizeLandmarkKeyword(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim()
  if (!t || isBrokenRegisterLandmarkKeyword(t)) return ''
  const persist = tryPersistScheduleImageKeyword(t)
  return persist.ok ? persist.value : ''
}

function scheduleHasBrokenKeywords(rows: readonly RegisterPrePhotoHealRow[]): boolean {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return false
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  for (const row of days) {
    if (isBrokenRegisterLandmarkKeyword(row.imageKeyword)) return true
    if (isBrokenRegisterLandmarkKeyword(row.imageKeyword2)) return true
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot === 'middle' && !String(row.imageKeyword ?? '').trim()) return true
    const a = String(row.imageKeyword ?? '').trim().toLowerCase()
    const b = String(row.imageKeyword2 ?? '').trim().toLowerCase()
    if (a && b && a === b) return true
  }
  return false
}

function healDescription(row: RegisterPrePhotoHealRow, maxDay: number): string {
  const current = String(row.description ?? '').trim()
  if (!isBrokenRegisterScheduleDescription(current, row.routeText)) return current
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
 * 숙소·식사 키워드만 비운다. 빈 슬롯을 다시 채우지 않는다 — 반복이면 파서/POI를 고친다.
 */
export function healRegisterPrePhotoSchedule<T extends RegisterPrePhotoHealRow>(
  rows: T[],
  opts: RegisterPrePhotoHealOpts,
): RegisterPrePhotoHealResult<T> {
  const notes: RegisterPrePhotoHealNote[] = []
  if (!rows.length) return { rows, notes, reappliedKeywords: false }
  const lane: RegisterAdminLane = opts.lane ?? 'package'
  const isFit = lane === 'air_hotel_free'

  if (isFit) {
    return { rows, notes, reappliedKeywords: false }
  }

  let working: T[] = rows.map((row) => {
    const kw = sanitizeLandmarkKeyword(row.imageKeyword)
    const kw2 = sanitizeLandmarkKeyword(row.imageKeyword2)
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

  if (scheduleHasBrokenKeywords(working)) {
    notes.push({ day: 0, field: 'imageKeyword', reason: 'parser_fix_required' })
  }

  const maxDay = Math.max(...working.map((r) => Number(r.day)).filter((d) => d > 0), 1)
  working = working.map((row) => {
    const before = String(row.description ?? '').trim()
    const description = healDescription(row, maxDay)
    if (description !== before) {
      notes.push({ day: Number(row.day), field: 'description', reason: 'filler_or_duplicate_resynth' })
    }
    return { ...row, description }
  })

  return { rows: working, notes, reappliedKeywords: false }
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
