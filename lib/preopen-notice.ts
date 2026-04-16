/** localStorage — `PreopenNoticeModal` 과 공유 */
export const PREOPEN_NOTICE_STORAGE_KEY = 'bt:preopen-notice:hidden-until' as const

/** 정식 오픈일 표기(문구·UI에서 동일 사용) */
export const PREOPEN_OFFICIAL_OPEN_DATE = '4월 21일' as const

function readHiddenUntilMs(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PREOPEN_NOTICE_STORAGE_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/** `hidden-until` 시각 이전이면 안내를 띄우지 않음 */
export function isPreopenNoticeSuppressed(nowMs: number = Date.now()): boolean {
  const until = readHiddenUntilMs()
  if (until == null) return false
  return nowMs < until
}

/** 다음날 0시(로컬)까지 숨김 — “오늘 하루 보지 않기” */
export function setPreopenNoticeHiddenUntilNextLocalMidnight(): void {
  if (typeof window === 'undefined') return
  const t = new Date()
  t.setDate(t.getDate() + 1)
  t.setHours(0, 0, 0, 0)
  try {
    localStorage.setItem(PREOPEN_NOTICE_STORAGE_KEY, String(t.getTime()))
  } catch {
    /* private mode 등 */
  }
}
