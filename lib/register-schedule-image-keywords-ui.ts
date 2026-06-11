/**
 * 서버 전용 — 공급사별 imageKeyword 규칙(미리보기 API·등록 파이프라인).
 * 클라이언트(`app/admin/register/page.tsx`)에서 import 금지 — gemini·파서 체인이 번들에 실림.
 * 스위치 SSOT: `register-schedule-image-keywords-apply.ts`
 */
import 'server-only'
import {
  applyRegisterScheduleImageKeywordsBySupplier,
  type ApplyRegisterScheduleImageKeywordsOpts,
  type RegisterScheduleImageKeywordApplyRow,
} from '@/lib/register-schedule-image-keywords-apply'

export type RegisterScheduleImageKeywordUiRow = RegisterScheduleImageKeywordApplyRow

export type ApplyRegisterScheduleImageKeywordsForUiOpts = ApplyRegisterScheduleImageKeywordsOpts

export function applyRegisterScheduleImageKeywordsForAdminUi<
  T extends RegisterScheduleImageKeywordUiRow,
>(rows: T[], opts: ApplyRegisterScheduleImageKeywordsForUiOpts): T[] {
  return applyRegisterScheduleImageKeywordsBySupplier(rows, opts)
}
