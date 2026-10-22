/**
 * 해외 등록대기 인입 — 국내여행 상품 차단 SSOT.
 * REGRESSION-FREEZE[register-ingest-reject-domestic-korea]: 국내 패키지·골프·당일 수집 금지 — manifest
 */

/** 해외 목적·항공사 증거가 있으면 국내로 보지 않음 (제주항공 보홀, 부산출발 괌). */
// REGRESSION-FREEZE[register-ingest-reject-domestic-korea]: 대청도≠중국 청도 — manifest
const OVERSEAS_EVIDENCE_RE =
  /괌|보홀|사이판|팔라우|세부|보라카이|방콕|푸켓|치앙마이|나트랑|달랏|다낭|하노이|호치민|푸꾸옥|대만|타이페이|홍콩|마카오|오사카|도쿄|후쿠오카|오키나와|삿포로|홋카이도|교토|고베|아와지|시모노세키|중국|베이징|상해|(?<![가-힣])청도(?![가-힣])|장가계|계림|양삭|리장|쿤밍|연태|(?<![가-힣])위해(?![가-힣])|백두|몽골|베트남|태국|필리핀|인도네시아|발리|싱가포르|말레이|코타키나발루|유럽|스페인|포르투갈|이탈리아|프랑스|독일|스위스|그리스|튀르키|터키|이집트|두바이|호주|뉴질랜드|하와이|미국|캐나다|중남미|칸쿤|아프리카|사파리|인도|네팔|몰디브|스리랑카|라오스|캄보디아|앙코르|시엠립|일본|대련|여순|울란바토르|Bangkok|Guam|Bohol|Tokyo|Osaka|Fukuoka|Jeju\s*Air(?!\s*\d일)/i

/** 항공사·지방출발 표기 — 국내 판별 haystack에서 제거 */
const AIRLINE_OR_LOCAL_DEP_NOISE_RE =
  /제주\s*항공|진에어|아시아나(?:항공)?|대한항공|트리니티|티웨이|에어서울|에어부산|부산출발|대구출발|청주출발|김해출발|인천출발|김포출발|\[부산출발\]|\[대구출발\]|\[청주출발\]/gi

/** 국내 여행·국내 골프·도서 당일 등 */
// REGRESSION-FREEZE[register-ingest-reject-domestic-korea]: 화천·충북·백령·대청도 당일 — manifest
const DOMESTIC_KOREA_RE =
  /국내\s*여행|국내\s*패키지|국내\s*관광|국내여행|대한민국|(?:강원|충북|충남|전남|전북|경북|경남|경기)\s*[가-힣]{0,6}\s*골프|강원\s*\/|충북\s*\/|거문도|울릉도|백령도|대청도|화천|옥천|보은|법주사|청남대|파로호|평화의\s*댐|충북웰니스|대청호|계족산|화진포|청간정|능파대|온돌민박|KTX\s*#|제주도|(?<![가-힣])제주\s*[1234]일|(?<![가-힣])제주(?![가-힣A-Za-z])\s*(?:로얄|시그니처|프리미엄)|강원\s*고성|고성\s*1일|제천\s*골프|원주\s*골프|홍성\s*골프|아산\s*골프|여수\s*골프|세레니티\s*C\.?C|이븐데일|동강시스타|웰리힐리|서산수\s*골프|경도\s*CC|(?:옥천|청주|보은|대전)\s*\/|(?:옥천|청주|보은)\s*2일|청주\s*\/\s*대전|(?:청주|대전)\s*당일/i

/**
 * 해외 인입 대상이 아닌 국내여행(패키지·당일·국내 골프)이면 true.
 * 지방출발·제주항공만으로 국내 판정하지 않음.
 */
export function isRegisterIngestDomesticKoreaProduct(
  titleOrHaystack: string | null | undefined,
  destination?: string | null,
  countryKey?: string | null,
): boolean {
  // REGRESSION-FREEZE[register-ingest-reject-domestic-korea]: countryKey korea 차단 — manifest
  if (String(countryKey ?? '').trim().toLowerCase() === 'korea') return true
  const raw = `${String(titleOrHaystack ?? '')}\n${String(destination ?? '')}`.trim()
  if (!raw) return false
  if (OVERSEAS_EVIDENCE_RE.test(raw)) return false
  const cleaned = raw.replace(AIRLINE_OR_LOCAL_DEP_NOISE_RE, ' ')
  return DOMESTIC_KOREA_RE.test(cleaned)
}

export const REGISTER_INGEST_DOMESTIC_KOREA_REJECT_REASON = 'domestic_korea_rejected' as const
