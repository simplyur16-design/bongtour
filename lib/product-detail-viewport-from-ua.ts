/** 상품 상세 SSR — 모바일 UA 판정 (서버 전용, `headers().get('user-agent')` 입력) */
export function isMobileUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false
  return /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent)
}
