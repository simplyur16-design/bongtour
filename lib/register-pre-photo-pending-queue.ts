/**
 * 등록대기 큐 게이트 — 셀프힐 후 검증 통과만 pending.
 * 힐이 고치지 못한 건은 올리지 않는다.
 * REGRESSION-FREEZE[register-pre-photo-parser-fix]: verify.ok 만 등록대기 — manifest
 * REGRESSION-FREEZE[register-pre-photo-pending-verify-gate]: pre_photo_blocked — manifest
 */

export const REGISTER_PRE_PHOTO_BLOCKED_STATUS = 'pre_photo_blocked'

export function isRegisterPrePhotoPendingQueueReady(verify: { ok: boolean }): boolean {
  return verify.ok === true
}

export function registrationStatusAfterPrePhotoVerify(verify: { ok: boolean }): 'pending' | 'pre_photo_blocked' {
  return isRegisterPrePhotoPendingQueueReady(verify) ? 'pending' : REGISTER_PRE_PHOTO_BLOCKED_STATUS
}

/** 등록대기만 geo 슬롯을 차지한다. 힐 실패 건은 큐에 안 올리고, 다음날 다른 상품을 받아 다시 교정한다. */
export function occupiesRegisterPrePhotoIngestSlot(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim()
  return s === '' || s === 'pending'
}

/** 키워드 검증 전 사진 고르기 금지 — pending·차단 모두. */
export function isRegisterPrePhotoKeywordPhotoGateStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim()
  return s === '' || s === 'pending' || s === REGISTER_PRE_PHOTO_BLOCKED_STATUS
}
