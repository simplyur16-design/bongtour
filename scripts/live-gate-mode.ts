/**
 * Live-gate / Gemini 실호출 스위치.
 * 기본(미설정·0): fixture·SKIP — 운영 Gemini 서비스 코드는 건드리지 않는다.
 * LIVE_GATES=1 일 때만 공급사·Gemini 실호출.
 */
export function isLiveGatesEnabled(): boolean {
  const raw = String(process.env.LIVE_GATES ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

/** FIT 예시일정 Gemini — live 가 아니면 등록 enrich 경로 호출 차단 */
export function applyAirtelFitGeminiSkipUnlessLive(): void {
  if (!isLiveGatesEnabled()) {
    process.env.SKIP_REGISTER_AIRTEL_FIT_GEMINI = '1'
  }
}
