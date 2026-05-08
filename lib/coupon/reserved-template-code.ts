/** 시스템 발급 템플릿 코드 — 공개 쿠폰 입력·검증 경로에서 거부 */
export function isReservedTemplateCode(code: string): boolean {
  return code.trim().startsWith("__TPL_");
}
