/**
 * 상품목록·대표 슬라이드·일정 사진 SEO에서 제외할 운영·요금·약관·상품코드 문구.
 * 파서/스크래퍼와 무관 — 등록 helper·공개 resolve·자산 캡션 보조 판별에 공통 사용.
 * REGRESSION-FREEZE[product-image-ops-seo-contamination]: 상품코드·단체번호·객실 미니바 — manifest
 * REGRESSION-FREEZE[product-image-seo-review-contamination]: 리뷰·여행후기·별점 — manifest
 * REGRESSION-FREEZE[product-image-seo-coreinfo-airline-contamination]: 여행핵심정보·항공사명 — manifest
 */

import { isAirlineCarrierImageKeyword } from '@/lib/pexels-place-name-keyword'

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
  '여행후기',
  '고객리뷰',
  '고객후기',
  '상품후기',
  '상품평점',
  '상품평',
  '평균별점',
  '트립어드바이저',
  '여행핵심정보',
  '상품핵심정보',
  '여행상품핵심정보',
  '핵심정보',
  '핵심포인트',
  '요약정보',
  '요약설명',
  '상품안내',
  '상품소개',
  '상품개요',
  '상품요약',
  '상품가격',
  '항공여정',
  '항공사',
  '여행도시',
  '출발인원',
  '상품특전',
  '여행주요일정',
  '주요방문지',
  '대한항공',
  '아시아나항공',
  '아시아나',
  '제주항공',
  '진에어',
  '티웨이항공',
  '티웨이',
  '에어부산',
  '에어서울',
  '이스타항공',
  '에어로케이',
  '에어프레미아',
  '에어프리미아',
  '싱가포르항공',
  '싱가폴항공',
  '중국남방항공',
  '중국동방항공',
  '중국국제항공',
  '캐세이퍼시픽',
  '케세이퍼시픽',
  '캐세이항공',
  '케세이항공',
  '베트남항공',
  '비엣젯',
  '에바항공',
  '타이항공',
  '말레이시아항공',
  '루프트한자',
  '에어프랑스',
  '영국항공',
  '카타르항공',
  '터키항공',
  '전일본공수',
  '일본항공',
  '피치항공',
  '에미레이트항공',
  '에티하드항공',
  '가루다항공',
  '스쿠트',
  '젯스타',
  '제트스타',
  '에어아시아',
] as const

const IMAGE_OPS_SEO_RE =
  /상품\s*코드|단체\s*번호|상품\s*번호|객실\s*내|미니바|minibar|디럭스\s*룸|슈페리어\s*룸|스탠다드\s*룸|호텔\s*소개|객실\s*전경|여행\s*기간|여행\s*일정|제세공과금|인솔자\s*동행|일정표상|인펀트|관광지\s*입장료|무료\s*(?:wifi|와이파이)|생수\s*제공|이전\s*다음|대리점|\d+\s*\/\s*\d+\s*이전|^\d+\s*일차\s*\||\b[A-Z]{2,5}\d{3,}[A-Z0-9]*\b|\b[A-Z]\d{2}[A-Z]-?\d{5,}\b|여행\s*후기|고객\s*(?:리뷰|후기)|상품\s*(?:평점|후기)|평균\s*별점|실제\s*여행객|\d+\s*명(?:의)?\s*리뷰|(?<!프)리뷰|\breviews?\b|tripadvisor|트립\s*어드바이저|★{2,}|별점\s*[0-5]|솔직히|너무\s*감사|행복한\s*시간|이용하고\s*싶|다음에\s*또\s*(?:가고|오고|이용)|솔직한\s*여행이야기|여행\s*핵심\s*정보|상품\s*핵심\s*정보|여행상품\s*핵심\s*정보|핵심\s*정보|핵심\s*포인트|요약\s*(?:정보|설명)|상품\s*(?:안내|소개|개요|요약|가격|특전)|항공\s*여정|항공\s*사(?:\s|$|[:：·])|여행\s*도시|출발\s*인원|여행\s*주요\s*일정|주요\s*방문지|(?:대한|제주|아시아나|이스타|티웨이|베트남|에바|타이|영국|카타르|터키|일본|피치|가루다|에미레이트|에티하드)\s*항공|진\s*에어|에어\s*(?:부산|서울|로케이|프레미아|프리미아|프랑스|아시아)|(?:캐|케)세이\s*(?:퍼시픽|항공)|중국\s*(?:남방|동방|국제)\s*항공|싱가포[르롤]\s*항공|비엣젯|루프트한자|전일본공수/i

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

const REVIEW_SECTION_CUT_RE =
  /(?:^|\n)\s*(?:여행\s*후기|고객\s*(?:리뷰|후기)|상품\s*평점|평균\s*별점|솔직한\s*여행이야기|실제\s*여행객\s*\d+\s*명의\s*리뷰|(?:^|\n)\s*리뷰\s*(?:\(|$|\s))/im

/**
 * 대표·일정 이미지 SEO 수확 전에 본문 리뷰 블록을 잘라낸다.
 * REGRESSION-FREEZE[product-image-seo-review-contamination]
 */
export function stripReviewSectionsFromImageSeoHaystack(text: string): string {
  const raw = String(text ?? '').replace(/\r\n/g, '\n')
  if (!raw.trim()) return ''
  const cut = raw.search(REVIEW_SECTION_CUT_RE)
  return (cut >= 0 ? raw.slice(0, cut) : raw).trimEnd()
}

/**
 * 이미지 SEO 토큰이 항공사·캐리어명인지.
 * 항공박물관·에미레이트 팰리스 등 랜드마크는 제외.
 * REGRESSION-FREEZE[product-image-seo-coreinfo-airline-contamination]
 */
export function isImageSeoAirlineCarrierToken(text: string): boolean {
  const t = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return false
  if (/박물관|우주과학|기념관|과학관|에미레이트\s*팰리스|에티하드\s*타워/u.test(t)) return false
  const compact = COMPACT_NO_SPACE(t)
  if (/^[가-힣A-Za-z][가-힣A-Za-z]{1,14}항공$/u.test(compact) && !/박물관|우주/.test(compact)) return true
  return isAirlineCarrierImageKeyword(t)
}

/** 상품코드·단체번호·객실 미니바·리뷰·여행핵심정보·항공사명 등 — 일정 사진 제목에도 사용 */
export function isProductImageOpsSeoContaminated(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return true
  const c = COMPACT_NO_SPACE(t)
  for (const w of IMAGE_OPS_SEO_COMPACT) {
    if (c.includes(w)) return true
  }
  if (IMAGE_OPS_SEO_RE.test(t)) return true
  if (isImageSeoAirlineCarrierToken(t)) return true
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
