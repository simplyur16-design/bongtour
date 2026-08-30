/**
 * 해외 패키지 수집 — 노옵션·노쇼핑 상품을 목록에서 먼저 고른다.
 * REGRESSION-FREEZE[register-pre-photo-ingest-no-option-no-shopping]: 패키지 노옵션·노쇼핑 우선 — manifest
 */

const NO_SHOP = /노\s*쇼핑|NO\s*쇼핑|쇼핑\s*없음/i
const NO_OPT = /노\s*옵션|노\s*업션|NO\s*옵션|옵션\s*없음|선택관광\s*없음/i

export function listingHaystackNoOptionNoShoppingScore(hay: string | null | undefined): number {
  const h = String(hay ?? '')
  if (!h.trim()) return 0
  return (NO_SHOP.test(h) ? 2 : 0) + (NO_OPT.test(h) ? 2 : 0)
}

export function listingHaystackIsNoOptionNoShopping(hay: string | null | undefined): boolean {
  return listingHaystackNoOptionNoShoppingScore(hay) >= 4
}

/** 점수가 높은 URL을 앞에. 점수 같으면 원래 순서. */
export function orderListingUrlsPreferNoOptionNoShopping(
  urls: readonly string[],
  haystackForUrl: (url: string) => string,
): string[] {
  return [...urls]
    .map((url, i) => ({ url, i, s: listingHaystackNoOptionNoShoppingScore(haystackForUrl(url)) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.url)
}
