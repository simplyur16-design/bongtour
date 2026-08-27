/**
 * 등록대기 큐 게이트 — 검증 통과만 pending.
 * 검증 실패·파서 수정 필요는 원인을 고친 뒤에만 올린다.
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

/** 등록대기·검증 실패 보류 모두 해당 geo 슬롯을 차지한다. 같은 슬롯에 실패 건을 계속 쌓지 않는다. */
export function occupiesRegisterPrePhotoIngestSlot(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim()
  return s === '' || s === 'pending' || s === REGISTER_PRE_PHOTO_BLOCKED_STATUS
}
