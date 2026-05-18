import { ScheduleImageKeywordPersistError } from '@/lib/schedule-image-keyword-persist'

const PEXELS_VIOLATION_RE = /\[PEXELS_KEYWORD_VIOLATION\]|PEXELS_KEYWORD_VIOLATION/

const OPERATOR_HINT =
  "이미지 키워드는 관광지 영문명만 입력하세요. 예: 'Osaka Castle'. 보조어(night view, skyline 등) 사용 불가. Night Market은 허용."

/** 저장·등록 UI용 — 기술 메시지를 운영자 친화 한국어로 변환 */
export function formatImageKeywordError(error: Error): string {
  const msg = (error.message ?? String(error)).trim()
  if (!msg) return OPERATOR_HINT

  if (error instanceof ScheduleImageKeywordPersistError || error.name === 'ScheduleImageKeywordPersistError') {
    if (PEXELS_VIOLATION_RE.test(msg)) {
      const patternMatch = msg.match(/\(패턴:\s*"([^"]+)"/)
      const banned = patternMatch?.[1]
      return banned ? `${OPERATOR_HINT} (감지: ${banned})` : OPERATOR_HINT
    }
  }

  if (PEXELS_VIOLATION_RE.test(msg)) {
    const patternMatch = msg.match(/\(패턴:\s*"([^"]+)"/)
    const banned = patternMatch?.[1]
    return banned ? `${OPERATOR_HINT} (감지: ${banned})` : OPERATOR_HINT
  }

  return msg
}
