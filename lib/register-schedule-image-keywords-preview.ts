/**
 * 등록 미리보기 UI — 공급사별 imageKeyword 규칙(클라이언트 번들용).
 * 스위치 SSOT: `register-schedule-image-keywords-apply.ts`
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]: preview — routeText만, stale kw 무시 — manifest
 */
import {
  applyRegisterScheduleImageKeywordsBySupplier,
  type ApplyRegisterScheduleImageKeywordsOpts,
  type RegisterScheduleImageKeywordApplyRow,
} from '@/lib/register-schedule-image-keywords-apply'

export type RegisterScheduleImageKeywordPreviewRow = RegisterScheduleImageKeywordApplyRow

export type ApplyRegisterScheduleImageKeywordsForPreviewOpts = ApplyRegisterScheduleImageKeywordsOpts

/** 미리보기 apply 입력 — 서버·Gemini가 채운 imageKeyword는 무시(routeText SSOT만) */
export function prepareRegisterScheduleImageKeywordPreviewRows<
  T extends RegisterScheduleImageKeywordPreviewRow,
>(rows: T[]): T[] {
  return rows.map((row) => ({
    ...row,
    imageKeyword: '',
    imageKeyword2: null,
  }))
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
