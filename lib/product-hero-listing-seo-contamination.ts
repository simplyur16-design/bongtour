/**
 * 상품목록·대표 슬라이드용 짧은 SEO 키워드/캡션에서 제외할 운영·요금·약관 성격 문구.
 * 파서/스크래퍼와 무관 — 등록 helper·공개 resolve·자산 캡션 보조 판별에 공통 사용.
 */

const COMPACT_NO_SPACE = (s: string) => s.replace(/\s/g, '')

/** 부분 일치로 차단(짧은 토큰·한 줄) */
const LISTING_SEO_CONTAMINATION_COMPACT = [
  '1인실',
  '객실추가요금',
  '추가요금',
  '싱글차지',
  '별도',
  '불포함',
  '포함사항',
  '불포함사항',
  '포함내역',
  '불포함내역',
  '선택관광',
  '현지옵션',
  '쇼핑',
  '비자',
  '샌딩',
  '가이드불포함',
  '기사팁',
  '예약금',
  '취소수수료',
  '약관',
  '최소출발',
  '현재예약',
  '남은좌석',
  '보험',
  '쿠폰',
  '포인트',
  '옵션',
] as const

const LISTING_SEO_CONTAMINATION_RE =
  /1인실|객실\s*추가\s*요금|추가\s*요금|싱글\s*차지|예약금|취소\s*수수료|최소\s*출발|현재\s*예약|남은\s*좌석|조식\s*불|중식\s*불|석식\s*불|가이드\s*불|기사\s*팁|미포함|부가\s*요금|현지\s*지불|유류할증|티\s*업|티업|옵션\s*\d|선택\s*관광/i

export function isProductHeroListingSeoContaminated(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return true
  const c = COMPACT_NO_SPACE(t)
  for (const w of LISTING_SEO_CONTAMINATION_COMPACT) {
    if (c.includes(w)) return true
  }
  if (LISTING_SEO_CONTAMINATION_RE.test(t)) return true
  return false
}
