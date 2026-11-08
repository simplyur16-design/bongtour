/** 카카오 상담 링크에 상품코드·상품명만 붙인다. 메시지는 보내지 않는다. */
export function kakaoConsultHref(
  base: string,
  info?: { productCode?: string | null; productTitle?: string | null },
): string {
  const code = info?.productCode?.trim()
  const title = info?.productTitle?.trim()
  if (!code && !title) return base
  try {
    const url = new URL(base)
    if (code) url.searchParams.set('productCode', code)
    if (title) url.searchParams.set('productTitle', title)
    return url.toString()
  } catch {
    return base
  }
}
