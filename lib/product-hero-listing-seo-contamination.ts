/**
 * 상품목록·대표 슬라이드·일정 사진 SEO에서 제외할 운영·요금·약관·상품코드 문구.
 * 파서/스크래퍼와 무관 — 등록 helper·공개 resolve·자산 캡션 보조 판별에 공통 사용.
 * REGRESSION-FREEZE[product-image-ops-seo-contamination]: 상품코드·단체번호·객실 미니바 — manifest
 */

const COMPACT_NO_SPACE = (s: string) => s.replace(/\s/g, '')

/** 이미지·히어로 SEO 공통 — 상품코드·단체번호·객실 어메니티 (명소명과 무관) */
const IMAGE_OPS_SEO_COMPACT = [
  '상품코드',
  '단체번호',
  '상품번호',
  '미니바',
  '객실내',
  '디럭스룸',
  '슈페리어룸',
  '스탠다드룸',
  '호텔소개',
  '객실전경',
  '여행기간',
  '여행일정',
  '제세공과금',
  '인솔자',
  '일정표상',
  '인펀트',
  '해외패키지',
  '세미패키지',
  '입장료',
  '무료wifi',
  '무료와이파이',
  '생수제공',
  '이전다음',
  '대리점',
  '하나투어',
  '모두투어',
  '참좋은',
  '노랑풍선',
  '롯데관광',
  '교원이지',
] as const

const IMAGE_OPS_SEO_RE =
  /상품\s*코드|단체\s*번호|상품\s*번호|객실\s*내|미니바|minibar|디럭스\s*룸|슈페리어\s*룸|스탠다드\s*룸|호텔\s*소개|객실\s*전경|여행\s*기간|여행\s*일정|제세공과금|인솔자\s*동행|일정표상|인펀트|관광지\s*입장료|무료\s*(?:wifi|와이파이)|생수\s*제공|이전\s*다음|대리점|\d+\s*\/\s*\d+\s*이전|^\d+\s*일차\s*\||\b[A-Z]{2,5}\d{3,}[A-Z0-9]*\b|\b[A-Z]\d{2}[A-Z]-?\d{5,}\b/i

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

/** 상품코드·단체번호·객실 미니바 등 — 일정 사진 제목에도 사용 */
export function isProductImageOpsSeoContaminated(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return true
  const c = COMPACT_NO_SPACE(t)
  for (const w of IMAGE_OPS_SEO_COMPACT) {
    if (c.includes(w)) return true
  }
  if (IMAGE_OPS_SEO_RE.test(t)) return true
  return false
}

export function isProductHeroListingSeoContaminated(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (isProductImageOpsSeoContaminated(t)) return true
  const c = COMPACT_NO_SPACE(t)
  for (const w of LISTING_SEO_CONTAMINATION_COMPACT) {
    if (c.includes(w)) return true
  }
  if (LISTING_SEO_CONTAMINATION_RE.test(t)) return true
  return false
}
