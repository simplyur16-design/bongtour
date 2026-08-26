/**
 * 사진 수급 전 검증 — 레인별 등록화면 설정과 일정 키워드·요약이 맞는지 본다.
 * throw 없음. 사진 생성 없음.
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 레인별 검증 스탬프 — manifest
 * REGRESSION-FREEZE[register-pre-photo-parser-fix]: 빈칸·블리드·FIT 공란은 parserFixRequired — manifest
 * REGRESSION-FREEZE[fit-pre-photo-verify-keywords]: FIT 키워드 공란이면 검증 실패 — manifest
 */
import {
  REGISTER_ADMIN_LANE_LABELS,
  canonicalSportsThemeTags,
  type RegisterAdminLane,
} from '@/lib/register-admin-lane'
import {
  isBrokenRegisterLandmarkKeyword,
  isBrokenRegisterScheduleDescription,
  type RegisterPrePhotoHealRow,
} from '@/lib/register-pre-photo-self-heal'
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import { isAirHotelListingKind, isAirHotelProductType } from '@/lib/air-hotel-product-ssot'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'

export const REGISTER_PRE_PHOTO_RAW_META_KEY = 'prePhoto'

export type RegisterPrePhotoVerifyIssue = string

export type RegisterPrePhotoVerifyResult = {
  lane: RegisterAdminLane
  laneLabel: string
  ok: boolean
  readyForOperatorPhoto: boolean
  parserFixRequired: boolean
  issues: RegisterPrePhotoVerifyIssue[]
}

export type RegisterPrePhotoRawMetaStamp = RegisterPrePhotoVerifyResult & {
  verifiedAt: string
}

function parseRawMetaObject(rawMeta: string | null | undefined): Record<string, unknown> {
  if (!rawMeta?.trim()) return {}
  try {
    const parsed = JSON.parse(rawMeta) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function packageScheduleIssues(rows: readonly RegisterPrePhotoHealRow[]): RegisterPrePhotoVerifyIssue[] {
  const issues: RegisterPrePhotoVerifyIssue[] = []
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) {
    issues.push('schedule_empty')
    return issues
  }
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  for (const row of days) {
    const day = Number(row.day)
    if (isBrokenRegisterLandmarkKeyword(row.imageKeyword)) {
      issues.push(`day${day}_keyword_lodging_or_non_landmark`)
    }
    if (isBrokenRegisterLandmarkKeyword(row.imageKeyword2)) {
      issues.push(`day${day}_keyword2_lodging_or_non_landmark`)
    }
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
    if (slot === 'middle' && !String(row.imageKeyword ?? '').trim()) {
      issues.push(`day${day}_middle_keyword_empty`)
    }
    if (isBrokenRegisterScheduleDescription(row.description, row.routeText)) {
      issues.push(`day${day}_description_filler_or_duplicate`)
    }
  }
  const seenKw = new Map<string, number>()
  for (const row of days) {
    const slot = resolveScheduleKeywordSlotKind(
      Number(row.day),
      maxDay,
      activeDays,
    )
    if (slot !== 'middle') continue
    const key = normScheduleImageKeywordKey(String(row.imageKeyword ?? '').trim())
    if (!key) continue
    const prev = seenKw.get(key)
    if (prev != null) {
      issues.push(`day${row.day}_keyword_bleed_other_day`)
    } else {
      seenKw.set(key, Number(row.day))
    }
  }
  return issues
}

function fitScheduleIssues(rows: readonly RegisterPrePhotoHealRow[]): RegisterPrePhotoVerifyIssue[] {
  const issues: RegisterPrePhotoVerifyIssue[] = []
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) {
    issues.push('schedule_empty')
    return issues
  }
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  let anyKeyword = false
  for (const row of days) {
    const day = Number(row.day)
    const kw = String(row.imageKeyword ?? '').trim()
    if (kw) anyKeyword = true
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
    if (slot === 'middle' && !kw) {
      issues.push(`day${day}_middle_keyword_empty`)
    }
  }
  if (!anyKeyword) {
    issues.push('fit_keyword_empty')
  }
  return issues
}

export function isRegisterPrePhotoParserFixIssue(issue: string): boolean {
  return (
    issue.includes('lodging_or_non_landmark') ||
    issue.includes('middle_keyword_empty') ||
    issue.includes('keyword_bleed_other_day') ||
    issue.includes('fit_keyword_empty') ||
    issue === 'schedule_empty'
  )
}

export function scheduleRowsForPrePhotoVerify(schedule: string | null | undefined): RegisterPrePhotoHealRow[] {
  if (!schedule?.trim()) return []
  try {
    const parsed = JSON.parse(schedule) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => {
      const row = item as Record<string, unknown>
      return {
        day: Number(row.day) || 0,
        title: row.title != null ? String(row.title) : null,
        description: row.description != null ? String(row.description) : null,
        routeText: row.routeText != null ? String(row.routeText) : null,
        imageKeyword: row.imageKeyword != null ? String(row.imageKeyword) : null,
        imageKeyword2: row.imageKeyword2 != null ? String(row.imageKeyword2) : null,
        imageUrl: row.imageUrl != null ? String(row.imageUrl) : null,
      }
    })
  } catch {
    return []
  }
}

export function verifyRegisterPrePhoto(args: {
  lane: RegisterAdminLane
  listingKind?: string | null
  productType?: string | null
  sportsThemeTag?: readonly string[] | null
  rows: readonly RegisterPrePhotoHealRow[]
}): RegisterPrePhotoVerifyResult {
  const issues: RegisterPrePhotoVerifyIssue[] = []
  const { lane } = args

  if (lane === 'air_hotel_free') {
    if (!isAirHotelListingKind(args.listingKind) && !isAirHotelProductType(args.productType)) {
      issues.push('fit_listingKind_mismatch')
    }
    issues.push(...fitScheduleIssues(args.rows))
  } else {
    if (isAirHotelListingKind(args.listingKind) || isAirHotelProductType(args.productType)) {
      issues.push('package_listingKind_is_fit')
    }
    issues.push(...packageScheduleIssues(args.rows))
  }

  if (lane === 'theme' && canonicalSportsThemeTags(args.sportsThemeTag).length === 0) {
    issues.push('theme_tag_missing')
  }

  const ok = issues.length === 0
  const parserFixRequired = issues.some(isRegisterPrePhotoParserFixIssue)
  return {
    lane,
    laneLabel: REGISTER_ADMIN_LANE_LABELS[lane],
    ok,
    readyForOperatorPhoto: ok,
    parserFixRequired,
    issues,
  }
}

export function mergeRegisterPrePhotoStampIntoRawMeta(
  rawMeta: string | null | undefined,
  stamp: RegisterPrePhotoVerifyResult,
  verifiedAt = new Date().toISOString(),
): string {
  const obj = parseRawMetaObject(rawMeta)
  obj[REGISTER_PRE_PHOTO_RAW_META_KEY] = {
    ...stamp,
    verifiedAt,
  } satisfies RegisterPrePhotoRawMetaStamp
  return JSON.stringify(obj)
}

export function readRegisterPrePhotoStampFromRawMeta(
  rawMeta: string | null | undefined,
): RegisterPrePhotoRawMetaStamp | null {
  const raw = parseRawMetaObject(rawMeta)[REGISTER_PRE_PHOTO_RAW_META_KEY]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const lane = o.lane
  if (lane !== 'package' && lane !== 'air_hotel_free' && lane !== 'theme') return null
  return {
    lane,
    laneLabel: typeof o.laneLabel === 'string' ? o.laneLabel : REGISTER_ADMIN_LANE_LABELS[lane],
    ok: o.ok === true,
    readyForOperatorPhoto: o.readyForOperatorPhoto === true,
    parserFixRequired: o.parserFixRequired === true || (Array.isArray(o.issues) && o.issues.some((x) => isRegisterPrePhotoParserFixIssue(String(x)))),
    issues: Array.isArray(o.issues) ? o.issues.map((x) => String(x)) : [],
    verifiedAt: typeof o.verifiedAt === 'string' ? o.verifiedAt : '',
  }
}
