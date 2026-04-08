/**
 * 관리자 붙여넣기 3축(항공·옵션·쇼핑) — 입력란이 있으면 해당 축은 본문/LLM·시그널 병합이 SSOT를 덮어쓰지 않는다.
 * (4공급사 공통 판정 — orchestration·register-parse에서 동일 기준 사용)
 */

export type ManualPasteAxesFlags = {
  hasManualFlightInput: boolean
  hasManualOptionalInput: boolean
  hasManualShoppingInput: boolean
}

export type PastedBlocksLike = {
  airlineTransport?: string | null
  optionalTour?: string | null
  shopping?: string | null
} | null
  | undefined

export function readManualPasteAxesFromBlocks(pasted: PastedBlocksLike): ManualPasteAxesFlags {
  return {
    hasManualFlightInput: Boolean(String(pasted?.airlineTransport ?? '').trim()),
    hasManualOptionalInput: Boolean(String(pasted?.optionalTour ?? '').trim()),
    hasManualShoppingInput: Boolean(String(pasted?.shopping ?? '').trim()),
  }
}
