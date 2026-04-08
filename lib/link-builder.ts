export function generateSmartLink(productId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bongtour.com'
  // 사장님이 영상에서 보여준 그 상품으로 바로 꽂아주는 다이렉트 링크
  // auth 파라미터를 붙여 로그인 없이도 사장님이 만든 고품격 상세페이지를 즉시 노출
  return `${baseUrl}/products/${productId}?auth=bongtour2026&utm_source=alimtalk`
}
