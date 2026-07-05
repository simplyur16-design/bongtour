/**
 * 등록 미리보기 UI — 공급사별 imageKeyword 규칙(클라이언트 번들용).
 * 스위치 SSOT: `register-schedule-image-keywords-apply.ts`
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]: preview — routeText 재적용, derive 실패 시 서버 키워드 보존 — manifest
 */
import {
  applyRegisterScheduleImageKeywordsBySupplier,
  type ApplyRegisterScheduleImageKeywordsOpts,
  type RegisterScheduleImageKeywordApplyRow,
} from '@/lib/register-schedule-image-keywords-apply'
import { tryPersistScheduleImageKeyword } from '@/lib/schedule-image-keyword-persist'

export type RegisterScheduleImageKeywordPreviewRow = RegisterScheduleImageKeywordApplyRow

export type ApplyRegisterScheduleImageKeywordsForPreviewOpts = ApplyRegisterScheduleImageKeywordsOpts

/** 미리보기 apply 입력 — 서버·Gemini가 채운 imageKeyword는 무시(routeText SSOT 재계산) */
export function prepareRegisterScheduleImageKeywordPreviewRows<
  T extends RegisterScheduleImageKeywordPreviewRow,
>(rows: T[]): T[] {
  return rows.map((row) => ({
    ...row,
    imageKeyword: '',
    imageKeyword2: null,
  }))
}

/** routeText 재계산이 비었을 때만 서버(post-augment) 키워드 보존 — stale 덮어쓰기는 derive 성공 시에만 */
export function mergePreviewImageKeywordsFromServerWhenDeriveEmpty<
  T extends RegisterScheduleImageKeywordPreviewRow,
>(derived: T[], serverRows: readonly T[]): T[] {
  if (!derived.length || !serverRows.length) return derived
  const serverByDay = new Map(serverRows.map((r) => [Number(r.day), r]))
  return derived.map((row) => {
    const day = Number(row.day)
    const server = serverByDay.get(day)
    const derivedKw = String(row.imageKeyword ?? '').trim()
    const derivedKw2 = String(row.imageKeyword2 ?? '').trim()
    const serverKw = String(server?.imageKeyword ?? '').trim()
    const serverKw2 = String(server?.imageKeyword2 ?? '').trim()
    return {
      ...row,
      imageKeyword: derivedKw || serverKw,
      imageKeyword2: derivedKw2 || serverKw2 || null,
    }
  })
}

export function softFinalizeRegisterScheduleImageKeywordsForPreview<
  T extends RegisterScheduleImageKeywordPreviewRow,
>(rows: T[]): T[] {
  return rows.map((row) => {
    const kwRaw = String(row.imageKeyword ?? '').trim()
    const kw2Raw = String(row.imageKeyword2 ?? '').trim()
    const kw = tryPersistScheduleImageKeyword(kwRaw)
    const kw2 = kw2Raw ? tryPersistScheduleImageKeyword(kw2Raw) : { ok: true as const, value: '' }
    return {
      ...row,
      imageKeyword: kw.ok ? kw.value : kwRaw,
      imageKeyword2: kw2.ok && kw2.value ? kw2.value : kw2Raw || null,
    }
  })
}

export function applyRegisterScheduleImageKeywordsForPreview<
  T extends RegisterScheduleImageKeywordPreviewRow,
>(rows: T[], opts: ApplyRegisterScheduleImageKeywordsForPreviewOpts): T[] {
  return applyRegisterScheduleImageKeywordsBySupplier(prepareRegisterScheduleImageKeywordPreviewRows(rows), opts)
}

/**
 * 미리보기 UI(`buildRegisterPexelsUiRows`)와 confirm 저장본이 같은 imageKeyword·imageKeyword2를 쓰도록
 * 일차별 SSOT 키워드를 LLM `parsed.schedule` 행에 덮어씌운다.
 */
export function overlayPreviewScheduleImageKeywords<
  T extends RegisterScheduleImageKeywordPreviewRow,
>(scheduleRows: T[], previewRows: RegisterScheduleImageKeywordPreviewRow[]): T[] {
  if (!scheduleRows.length || !previewRows.length) return scheduleRows
  const byDay = new Map(previewRows.map((r) => [Number(r.day), r]))
  return scheduleRows.map((row) => {
    const day = Number(row.day)
    if (!Number.isFinite(day) || day < 1) return row
    const ssot = byDay.get(day)
    if (!ssot) return row
    const kw2 = String(ssot.imageKeyword2 ?? '').trim()
    return {
      ...row,
      imageKeyword: String(ssot.imageKeyword ?? '').trim(),
      imageKeyword2: kw2 ? kw2 : null,
    }
  })
}
