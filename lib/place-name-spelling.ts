/**
 * REGRESSION-FREEZE[place-name-spelling-n1]: 지명·호텔명 표준 한국어 표기 (N1) — 사장님 2026-10-30 23:24
 * 「이상한 듣도 못한 이름 가져다 쓰는경우가 없게하라」
 *
 * 규칙
 * - 사전(아래 PLACE_NAME_SPELLING_DICTIONARY)의 `certain` 항목만 자동 교정한다. 지어내지 않는다.
 * - `uncertain` 항목·의심 이름·한 글 안 표기 혼용은 교정하지 않고 플래그(관리자 검수)만 남긴다.
 * - 공급사 원문 저장 필드(originalTitle·rawTitle·highlightPointsRaw·ItineraryDay·schedule 원문)는 바꾸지 않는다.
 *   교정은 화면 출력(render) 시점과 Gemini 생성문(생성 직후)에만 적용한다.
 * - 가격·숫자는 다루지 않는다(문자열 지명만).
 *
 * 기준 순서(문과장 N1): ① 국립국어원 외래어 표기법·용례 ② 관광청·기관·호텔 공식 한국어 표기 ③ 주요 언론·포털 통용.
 * 사장님 결정(2026-10-30 23:44): 흔히 쓰는 이름(업계 통용)이 표준. 나트랑·푸켓·호치민·씨엠립은 냐짱·푸껫·호찌민·시엠레아프 등으로 바꾸지 않는다.
 *   통용 vs 국립국어원 표기가 갈리는 쌍은 PLACE_NAME_COMMON_VS_STANDARD(사장님 결정 대기)로 빼고 자동 교정하지 않는다.
 * 단, 외래어 표기법 제4장 제2절 제4항(중국·일본 지명의 한국 한자음 관용 허용: 동경·상해·북경·장가계 등)은 오류로 보지 않는다.
 *
 * 이 파일은 외부 import 없이 동작해야 한다(감사 스크립트가 node 타입 스트립으로 직접 실행).
 */

export type PlaceNameKind = 'place' | 'landmark' | 'hotel' | 'country' | 'brand'
export type PlaceNameConfidence = 'certain' | 'uncertain'

export type PlaceNameSpellingEntry = {
  variant: string
  standard: string
  kind: PlaceNameKind
  confidence: PlaceNameConfidence
  /** 근거: N1 ①②③ + 규칙 또는 URL */
  source: string
  /** 바로 뒤에 이 문자열이 오면 교정하지 않음 (예: 터키항공) */
  notBefore?: readonly string[]
  /** 바로 앞이 이 문자열로 끝나면 교정하지 않음 (예: 기타큐슈) */
  notAfter?: readonly string[]
  /** uncertain 사유 / 정책 충돌 메모 */
  note?: string
  /** uncertain 중 국립국어원 표기 vs 통용 표기 정책 충돌 */
  policy?: boolean
}

const SRC_JA =
  'N1① 외래어 표기법 일본어 표기(つ→쓰, 어두 か·た행→ㄱ·ㄷ) https://kornorms.korean.go.kr/regltn/regltnView.do?regltn_code=0003'
const SRC_ID = 'N1① 외래어 표기법 말레이인도네시아어 표기(된소리 안 씀) https://kornorms.korean.go.kr/regltn/regltnView.do?regltn_code=0003'
const SRC_DE = 'N1① 외래어 표기법 독일어 표기 https://kornorms.korean.go.kr/regltn/regltnView.do?regltn_code=0003'
const SRC_KORNORMS = 'N1① 국립국어원 외래어 표기 용례 https://kornorms.korean.go.kr/example/exampleList.do'
const SRC_OWNER_COMMON = '사장님 결정 2026-10-30 23:44 「흔히 쓰는 이름이 표준」(통용 표기 우선)'

export const PLACE_NAME_SPELLING_DICTIONARY: readonly PlaceNameSpellingEntry[] = [
  // ── 베트남
  { variant: '푸꼽옥', standard: '푸꾸옥', kind: 'place', confidence: 'certain', source: 'N1 예시(문과장) + N1② 베트남관광청 표기 푸꾸옥' },
  { variant: '푸꾸욱', standard: '푸꾸옥', kind: 'place', confidence: 'certain', source: 'N1 예시(푸꾸옥) — 오타' },
  { variant: '푸꾸억', standard: '푸꾸옥', kind: 'place', confidence: 'certain', source: 'N1 예시(푸꾸옥) — 오타' },
  { variant: '푸쿠옥', standard: '푸꾸옥', kind: 'place', confidence: 'certain', source: 'N1 예시(푸꾸옥) — 오타' },
  // ── 라오스
  // ── 인도네시아
  // ── 일본
  { variant: '카고시마', standard: '가고시마', kind: 'place', confidence: 'certain', source: SRC_JA },
  { variant: '타카야마', standard: '다카야마', kind: 'place', confidence: 'certain', source: SRC_JA },
  { variant: '카나자와', standard: '가나자와', kind: 'place', confidence: 'certain', source: SRC_JA },
  { variant: '훗카이도', standard: '홋카이도', kind: 'place', confidence: 'certain', source: SRC_JA },
  { variant: '삿뽀로', standard: '삿포로', kind: 'place', confidence: 'certain', source: SRC_JA },
  { variant: '유휴인', standard: '유후인', kind: 'place', confidence: 'certain', source: SRC_JA },
  // ── 중국 (한자음 관용은 허용 — 오타만)
  { variant: '효도협', standard: '호도협', kind: 'landmark', confidence: 'certain', source: 'N1① 虎跳峽 한자음 호도협(제4장 제2절 제4항 관용) — 효/호 오타' },
  // ── 유럽·튀르키예
  { variant: '이태리', standard: '이탈리아', kind: 'country', confidence: 'certain', source: `${SRC_KORNORMS} (Italia 이탈리아; 이태리는 음역 비표준)` },
  { variant: '잘츠캄머구트', standard: '잘츠카머구트', kind: 'place', confidence: 'certain', source: SRC_DE },
  { variant: '짤츠부르크', standard: '잘츠부르크', kind: 'place', confidence: 'certain', source: SRC_DE },
  { variant: '하이델베르그', standard: '하이델베르크', kind: 'place', confidence: 'certain', source: SRC_DE },
  { variant: '노이슈반스타인', standard: '노이슈반슈타인', kind: 'landmark', confidence: 'certain', source: SRC_DE },
  { variant: '몽생미쉘', standard: '몽생미셸', kind: 'landmark', confidence: 'certain', source: SRC_KORNORMS },
  { variant: '오끼나와', standard: '오키나와', kind: 'place', confidence: 'certain', source: SRC_JA },
  { variant: '도톰보리', standard: '도톤보리', kind: 'landmark', confidence: 'certain', source: `${SRC_JA} — 오타` },
  { variant: '마추피추', standard: '마추픽추', kind: 'landmark', confidence: 'certain', source: `${SRC_KORNORMS} (Machu Picchu 마추픽추)` },
  { variant: '하와리', standard: '하와이', kind: 'place', confidence: 'certain', source: `${SRC_KORNORMS} (Hawaii 하와이) — 오타` },
  { variant: '포르토', standard: '포르투', kind: 'place', confidence: 'uncertain', source: `${SRC_KORNORMS} (Porto 포르투) — 포르토피노 등 다른 지명과 혼동 우려로 확인 필요`, note: '리스본과 함께 쓰이면 포르투' },
  { variant: '싱가폴', standard: '싱가포르', kind: 'country', confidence: 'certain', source: SRC_KORNORMS },

  // ── 사장님 결정 2026-10-30 23:44 「흔히 쓰는 나트랑·푸켓·호치민·씨엠립으로 통일」 — 통용 표기가 표준
  { variant: '냐짱', standard: '나트랑', kind: 'place', confidence: 'certain', source: SRC_OWNER_COMMON },
  { variant: '푸껫', standard: '푸켓', kind: 'place', confidence: 'certain', source: SRC_OWNER_COMMON },
  { variant: '푸께', standard: '푸켓', kind: 'place', confidence: 'certain', source: SRC_OWNER_COMMON },
  { variant: '푸껓', standard: '푸켓', kind: 'place', confidence: 'certain', source: SRC_OWNER_COMMON },
  { variant: '푸껑', standard: '푸켓', kind: 'place', confidence: 'certain', source: SRC_OWNER_COMMON },
  { variant: '호찌민', standard: '호치민', kind: 'place', confidence: 'certain', source: SRC_OWNER_COMMON },
  { variant: '시엠레아프', standard: '씨엠립', kind: 'place', confidence: 'certain', source: `${SRC_OWNER_COMMON} · N1③ 업계 통용 씨엠립(하나투어·모두투어·아세안문화원)` },
  { variant: '시엠립', standard: '씨엠립', kind: 'place', confidence: 'certain', source: `${SRC_OWNER_COMMON} · N1③ 업계 통용 씨엠립(하나투어·모두투어·아세안문화원)` },

  // ── uncertain: 교정하지 않고 플래그만
  { variant: '혼똠섬', standard: '혼똔섬', kind: 'place', confidence: 'uncertain', source: 'N1 「한 글 안 같은 표기」 — Hòn Thơm, 상품 대부분 혼똔섬 사용', note: '표준 표기 확인 안 됨(규칙상 혼텀) — 통일 방향만 제안' },
  { variant: '테렐지', standard: '테를지', kind: 'place', confidence: 'uncertain', source: 'N1③ 통용 표기 혼재(Terelj) — 확인 필요', note: '표준 표기 확인 안 됨' },
  { variant: '터키항공', standard: '튀르키예항공', kind: 'brand', confidence: 'uncertain', source: 'N1② 항공사 공식 한국어 상호 확인 필요(Turkish Airlines)', note: '항공사 상호는 국명 변경과 별개일 수 있음' },
  { variant: '쯔뵐프호른', standard: '츠뵐퍼호른', kind: 'landmark', confidence: 'uncertain', source: `${SRC_DE} (Zwölferhorn) — 확인 필요` },
  { variant: '오오츠리바시', standard: '오쓰리바시', kind: 'landmark', confidence: 'uncertain', source: `${SRC_JA} (장음 미표기) — 확인 필요` },
  { variant: '츠카사', standard: '쓰카사', kind: 'hotel', confidence: 'uncertain', source: 'N1 호텔명은 공식 한국어 표기 우선 — 공식 표기 확인 안 됨' },
  { variant: '후게츠', standard: '후게쓰', kind: 'hotel', confidence: 'uncertain', source: 'N1 호텔명은 공식 한국어 표기 우선 — 공식 표기 확인 안 됨' },
]

/**
 * 통용 표기(a, 여행업계) vs 국립국어원 표기(b) — 사장님 결정 대기. 자동 교정·플래그 모두 하지 않음(둘 다 허용).
 * 근거·건수: /workspace/live/name-spelling-1030/common-vs-standard-for-owner.csv
 */
export const PLACE_NAME_COMMON_VS_STANDARD: readonly (readonly [string, string])[] = [
  ['벳부', '벳푸'],
  ['큐슈', '규슈'],
  ['마츠야마', '마쓰야마'],
  ['마츠에', '마쓰에'],
  ['마츠모토', '마쓰모토'],
  ['다카마츠', '다카마쓰'],
  ['타카마츠', '다카마쓰'],
  ['카츠야마', '가쓰야마'],
  ['사츠마', '사쓰마'],
  ['노보리베츠', '노보리베쓰'],
  ['도게츠교', '도게쓰교'],
  ['시코츠', '시코쓰'],
  ['유노츠보', '유노쓰보'],
  ['가츠라하마', '가쓰라하마'],
  ['미츠코시', '미쓰코시'],
  ['미츠이', '미쓰이'],
  ['쿠로가와', '구로카와'],
  ['쿠마모토', '구마모토'],
  ['키타큐슈', '기타큐슈'],
  ['비엔티엔', '비엔티안'],
  ['울루와뚜', '울루와투'],
  ['꾸따', '쿠타'],
  ['따만미니', '타만미니'],
  ['쁘람바난', '프람바난'],
  ['유니버셜', '유니버설'],
  ['터키', '튀르키예'],
  ['돌로미테', '돌로미티'],
  ['쉔부른', '쇤브룬'],
  ['블라디보스톡', '블라디보스토크'],
  ['울란바타르', '울란바토르'],
  ['타이페이', '타이베이'],
  ['두브로브닉', '두브로브니크'],
]

/** 한 글 안 혼용 검사(둘 다 허용 표기라도 섞이면 플래그) — 외래어 표기법 제4장 제2절 제4항 관용 쌍 */
export const PLACE_NAME_CONSISTENCY_PAIRS: readonly (readonly [string, string])[] = [
  ['샤먼', '하문'],
  ['칭다오', '청도'],
  ['상하이', '상해'],
  ['베이징', '북경'],
  ['구이린', '계림'],
  ['시안', '서안'],
  ['도쿄', '동경'],
  ['홋카이도', '북해도'],
  ['장자제', '장가계'],
  ['다롄', '대련'],
  ['옌타이', '연태'],
  ['쿤밍', '곤명'],
  ['항저우', '항주'],
  ['혼똔섬', '혼똠섬'],
  ['테를지', '테렐지'],
  ['규슈', '큐슈'],
  ['벳푸', '벳부'],
  ['마쓰야마', '마츠야마'],
]

/** 의심 이름 탐지용 표준 지명 목록(사전 표준값 + 자주 쓰는 목적지). 존재하는 표준 표기만. */
export const PLACE_NAME_GAZETTEER: readonly string[] = [
  '푸꾸옥', '다낭', '호이안', '나트랑', '달랏', '하노이', '하롱베이', '사파', '호치민', '무이네', '판티엣', '혼똔섬',
  '방콕', '파타야', '치앙마이', '치앙라이', '푸켓', '끄라비', '크라비', '코사무이', '아유타야', '후아힌',
  '세부', '보홀', '보라카이', '마닐라', '팔라완', '클락', '코타키나발루', '쿠알라룸푸르', '말라카', '랑카위', '페낭', '겐팅',
  '싱가포르', '센토사', '발리', '우붓', '스미냑', '누사두아', '울루와투', '자카르타', '족자카르타', '마나도', '부나켄',
  '비엔티안', '방비엥', '루앙프라방', '씨엠립', '앙코르와트', '프놈펜',
  '오사카', '교토', '고베', '나라', '도쿄', '요코하마', '하코네', '후쿠오카', '유후인', '벳푸', '구마모토', '가고시마',
  '나가사키', '사세보', '미야자키', '오이타', '기타큐슈', '규슈', '삿포로', '오타루', '하코다테', '홋카이도', '후라노', '비에이',
  '노보리베쓰', '오키나와', '나하', '나고야', '가나자와', '다카야마', '시라카와고', '도야마', '마쓰야마', '다카마쓰', '시코쿠',
  '히로시마', '오카야마', '돗토리', '요나고', '마쓰에', '시즈오카', '센다이', '아오모리', '니가타', '마쓰모토', '구로카와',
  '아소', '다자이후', '하카타', '아라시야마', '도톤보리', '신사이바시', '아사쿠사', '시부야', '신주쿠', '후지산', '가와구치코',
  '장가계', '원가계', '천문산', '상해', '상하이', '북경', '베이징', '청도', '칭다오', '계림', '양삭', '서안', '시안', '하문', '샤먼',
  '대련', '연길', '백두산', '황산', '구채구', '리장', '여강', '쿤밍', '곤명', '태항산', '호도협', '옥룡설산', '항주', '소주',
  '홍콩', '마카오', '타이베이', '가오슝', '타이중', '지우펀', '스펀', '예류', '단수이', '화롄',
  '울란바토르', '테를지', '고비사막', '블라디보스토크', '하바롭스크', '이르쿠츠크', '바이칼',
  '파리', '런던', '로마', '피렌체', '베네치아', '밀라노', '나폴리', '폼페이', '소렌토', '포지타노', '아말피', '친퀘테레', '토스카나',
  '돌로미티', '바르셀로나', '마드리드', '세비야', '그라나다', '론다', '톨레도', '리스본', '포르투', '신트라',
  '프라하', '체스키크룸로프', '빈', '비엔나', '잘츠부르크', '할슈타트', '잘츠카머구트', '부다페스트', '브라티슬라바',
  '두브로브니크', '스플리트', '플리트비체', '자그레브', '류블랴나', '블레드', '코토르',
  '인터라켄', '융프라우', '체르마트', '루체른', '그린델발트', '몽블랑', '샤모니',
  '뮌헨', '퓌센', '노이슈반슈타인', '하이델베르크', '로텐부르크', '뉘른베르크', '베를린', '드레스덴', '프랑크푸르트',
  '이스탄불', '카파도키아', '파묵칼레', '안탈리아', '튀르키예', '아테네', '산토리니', '메테오라',
  '몽생미셸', '니스', '모나코', '에즈', '아비뇽', '콜마르', '스트라스부르',
  '시드니', '멜버른', '브리즈번', '골드코스트', '오클랜드', '퀸스타운', '하와이', '호놀룰루', '괌', '사이판',
  '두바이', '아부다비', '카이로', '룩소르', '아스완', '페트라', '마추픽추', '우유니', '이과수',
]

// ── 한글 자모 분해 (의심 이름 탐지)
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
function syllableParts(ch: string): [string, string, number] | null {
  const code = ch.charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) return null
  return [CHO[Math.floor(code / 588)], JUNG[Math.floor((code % 588) / 28)], code % 28]
}

export type PlaceNameSpellingHit = {
  variant: string
  standard: string
  kind: PlaceNameKind
  confidence: PlaceNameConfidence
  source: string
  index: number
  policy?: boolean
  note?: string
}

export type PlaceNameSpellingFlag =
  | { type: 'dictionary_uncertain'; variant: string; suggestion: string; source: string; policy: boolean; note?: string }
  | { type: 'suspicious_name'; token: string; nearest: string; source: string }
  | { type: 'mixed_spelling'; a: string; b: string; source: string }

function sortedEntries(conf: PlaceNameConfidence): PlaceNameSpellingEntry[] {
  return PLACE_NAME_SPELLING_DICTIONARY.filter((e) => e.confidence === conf).sort(
    (a, b) => b.variant.length - a.variant.length,
  )
}
const CERTAIN = sortedEntries('certain')
const UNCERTAIN = sortedEntries('uncertain')

function guardOk(text: string, idx: number, e: PlaceNameSpellingEntry): boolean {
  const after = text.slice(idx + e.variant.length)
  const before = text.slice(0, idx)
  if (e.notBefore?.some((s) => s && after.startsWith(s))) return false
  if (e.notAfter?.some((s) => s && before.endsWith(s))) return false
  return true
}

/** 사전 hit 위치 찾기 (겹침 없이, 긴 변이 우선) */
export function findPlaceNameSpellingHits(
  text: string | null | undefined,
  opts?: { includeUncertain?: boolean },
): PlaceNameSpellingHit[] {
  const s = typeof text === 'string' ? text : ''
  if (!s) return []
  const entries = opts?.includeUncertain ? [...CERTAIN, ...UNCERTAIN].sort((a, b) => b.variant.length - a.variant.length) : CERTAIN
  const taken: boolean[] = new Array(s.length).fill(false)
  const hits: PlaceNameSpellingHit[] = []
  for (const e of entries) {
    let from = 0
    for (;;) {
      const i = s.indexOf(e.variant, from)
      if (i < 0) break
      from = i + 1
      let free = true
      for (let k = i; k < i + e.variant.length; k++) if (taken[k]) free = false
      if (!free || !guardOk(s, i, e)) continue
      for (let k = i; k < i + e.variant.length; k++) taken[k] = true
      hits.push({
        variant: e.variant,
        standard: e.standard,
        kind: e.kind,
        confidence: e.confidence,
        source: e.source,
        index: i,
        ...(e.policy ? { policy: true } : {}),
        ...(e.note ? { note: e.note } : {}),
      })
    }
  }
  return hits.sort((a, b) => a.index - b.index)
}

/** certain 사전 hit만 표준 표기로 바꾼다. 그 외 글자는 그대로. */
export function normalizePlaceNameSpelling(text: string): { text: string; hits: PlaceNameSpellingHit[] } {
  if (typeof text !== 'string' || !text) return { text, hits: [] }
  const hits = findPlaceNameSpellingHits(text)
  if (!hits.length) return { text, hits }
  let out = ''
  let cur = 0
  for (const h of hits) {
    out += text.slice(cur, h.index) + h.standard
    cur = h.index + h.variant.length
  }
  out += text.slice(cur)
  return { text: out, hits }
}

/** 문자열 하나를 표시용으로 교정(null/비문자열은 그대로) */
export function normalizePlaceNameSpellingText<T>(v: T): T {
  if (typeof v !== 'string' || !v) return v
  return normalizePlaceNameSpelling(v).text as unknown as T
}

const GAZ_SET = new Set(PLACE_NAME_GAZETTEER)
const STANDARD_SET = new Set([...PLACE_NAME_GAZETTEER, ...PLACE_NAME_SPELLING_DICTIONARY.map((e) => e.standard)])
const VARIANT_SET = new Set([
  ...PLACE_NAME_SPELLING_DICTIONARY.map((e) => e.variant),
  ...PLACE_NAME_COMMON_VS_STANDARD.flat(),
])

/** 지명 뒤에 붙는 흔한 꼬리말(띄어쓰기 없는 제목 대응) */
const SUSPICIOUS_TAIL_RE =
  /^(섬|성|시|역|항|도|산|강|호|만|해변|비치|공항|시내|시티|온천|자유여행|자유|여행|투어|일주|관광|핵심|직항|출발|의|에서|에|으로|로|와|과|및|까지|부터)$/

/** 표기상 비슷하지만 실제로 다른 지명(오탐 제외) */
const NOT_SUSPICIOUS = new Set(['와카야마', '마쓰야', '아마쿠사', '사이마', '카이도', '오카이도', '타이쿤', '굿바이', '프라자', '스트리트', '모나크'])

/** 표준 지명과 한 음절만 다르고 그 음절의 초성 또는 중성이 같은 3음절 이상 조각 → 의심(오타 가능) */
function nearMissOf(window: string, std: string): boolean {
  if (window.length !== std.length || window === std) return false
  let diff = -1
  for (let i = 0; i < std.length; i++) {
    if (window[i] !== std[i]) {
      if (diff >= 0) return false
      diff = i
    }
  }
  if (diff < 0) return false
  const a = syllableParts(window[diff])
  const b = syllableParts(std[diff])
  if (!a || !b) return false
  return a[0] === b[0] || a[1] === b[1]
}

/** 교정 금지 — 플래그(관리자 검수)만. 사전 uncertain + 의심 이름 + 혼용. */
export function detectPlaceNameSpellingFlags(texts: readonly (string | null | undefined)[]): PlaceNameSpellingFlag[] {
  const flags: PlaceNameSpellingFlag[] = []
  const seen = new Set<string>()
  const joined = texts.filter((t): t is string => typeof t === 'string' && !!t).join('\n')
  if (!joined) return flags
  for (const h of findPlaceNameSpellingHits(joined, { includeUncertain: true })) {
    if (h.confidence !== 'uncertain') continue
    const k = `u:${h.variant}`
    if (seen.has(k)) continue
    seen.add(k)
    flags.push({ type: 'dictionary_uncertain', variant: h.variant, suggestion: h.standard, source: h.source, policy: !!h.policy, ...(h.note ? { note: h.note } : {}) })
  }
  const tokens = joined.match(/[가-힣]{3,}/g) ?? []
  for (const tok of new Set(tokens)) {
    for (const std of STANDARD_SET) {
      if (std.length < 3 || std.length > tok.length) continue
      // 조각 오탐 방지: 토큰 전체 또는 「이름+알려진 꼬리말」 형태일 때만 비교
      const tail = tok.slice(std.length)
      if (tail && !SUSPICIOUS_TAIL_RE.test(tail)) continue
      {
        const w = tok.slice(0, std.length)
        if (STANDARD_SET.has(w) || VARIANT_SET.has(w) || GAZ_SET.has(w) || NOT_SUSPICIOUS.has(w)) continue
        if (!nearMissOf(w, std)) continue
        const k = `s:${w}`
        if (seen.has(k)) continue
        seen.add(k)
        flags.push({ type: 'suspicious_name', token: w, nearest: std, source: 'N1 확인 필요 — 표준 지명과 한 음절 차이(오타 의심)' })
      }
    }
  }
  for (const [a, b] of PLACE_NAME_CONSISTENCY_PAIRS) {
    if (joined.includes(a) && joined.includes(b)) {
      const k = `m:${a}|${b}`
      if (seen.has(k)) continue
      seen.add(k)
      flags.push({ type: 'mixed_spelling', a, b, source: 'N1 「한 글 안에서 같은 이름은 같은 표기」' })
    }
  }
  return flags
}

/** Gemini 생성 프롬프트에 붙이는 규칙(추천일정·핵심포인트 정리본·요약·제목) */
export const PLACE_NAME_SPELLING_PROMPT_RULE = `[지명·호텔명 표기 규칙 — 필수]
- 지명·호텔명·명소명은 한국 여행업계에서 흔히 쓰는 표기를 쓴다(예: 나트랑·푸켓·호치민·씨엠립·푸꾸옥). 냐짱·푸껫·호찌민·시엠레아프처럼 낯선 표기로 바꾸지 않는다.
- 명백한 오타만 바로잡는다(예: 푸꼽옥 → 푸꾸옥, 효도협 → 호도협, 시엠립 → 씨엠립). 그 밖의 표기는 원문 표기를 그대로 쓴다.
- 원문에 없는 지명·호텔명·명소명을 새로 만들거나 추측해서 쓰지 않는다.
- 한 결과물 안에서 같은 이름은 같은 표기로 쓴다.
- 가격·금액·숫자는 원문 그대로 두고 바꾸거나 추정하지 않는다.`

/** 핵심포인트 추출용 — 원문 필드(highlightPointsRaw)는 그대로, 정리본(highlightPoints)에만 표준 표기 */
export const PLACE_NAME_SPELLING_HIGHLIGHT_PROMPT_RULE = `
지명·호텔명 표기:
- highlightPointsRaw는 공급사 원문 표기 그대로 둔다(고치지 않음).
- highlightPoints에서는 업계 통용 표기를 쓰고 명백한 오타만 바로잡는다(예: 푸꼽옥→푸꾸옥). 나트랑·푸켓·호치민·씨엠립을 냐짱·푸껫·호찌민·시엠레아프로 바꾸지 않는다. 그 밖에는 원문 표기 그대로 쓰고, 원문에 없는 이름은 만들지 않는다.
`

/** Gemini 출력 사후 검사: certain 교정 + 플래그 */
export function postCheckGeneratedPlaceNames(text: string | null | undefined): {
  text: string | null
  hits: PlaceNameSpellingHit[]
  flags: PlaceNameSpellingFlag[]
} {
  if (typeof text !== 'string' || !text) return { text: text ?? null, hits: [], flags: [] }
  const n = normalizePlaceNameSpelling(text)
  return { text: n.text, hits: n.hits, flags: detectPlaceNameSpellingFlags([text]) }
}

export type PlaceNameSpellingReview = {
  version: 'n1-v1'
  /** 화면 출력 시 자동 교정되는(certain) 항목 — 저장 원문은 그대로 */
  autoDisplayFixes: Array<{ field: string; variant: string; standard: string; source: string }>
  /** 교정하지 않은 검수 대상 */
  flags: Array<PlaceNameSpellingFlag & { field: string }>
}

/** 필드별 검사 → rawMeta.placeNameSpellingReview 용 (결정적: 시각 없음 → 변경 없으면 같은 문자열) */
export function buildPlaceNameSpellingReview(fields: Record<string, string | null | undefined>): PlaceNameSpellingReview | null {
  const autoDisplayFixes: PlaceNameSpellingReview['autoDisplayFixes'] = []
  const flags: PlaceNameSpellingReview['flags'] = []
  const fixSeen = new Set<string>()
  const flagSeen = new Set<string>()
  for (const field of Object.keys(fields).sort()) {
    const v = fields[field]
    if (typeof v !== 'string' || !v) continue
    for (const h of findPlaceNameSpellingHits(v)) {
      const k = `${field}|${h.variant}`
      if (fixSeen.has(k)) continue
      fixSeen.add(k)
      autoDisplayFixes.push({ field, variant: h.variant, standard: h.standard, source: h.source })
    }
    for (const f of detectPlaceNameSpellingFlags([v])) {
      const k = `${field}|${JSON.stringify(f)}`
      if (flagSeen.has(k)) continue
      flagSeen.add(k)
      flags.push({ ...f, field })
    }
  }
  const all = Object.values(fields).filter((x): x is string => typeof x === 'string')
  for (const f of detectPlaceNameSpellingFlags(all)) {
    if (f.type !== 'mixed_spelling') continue
    const k = `*|${JSON.stringify(f)}`
    if (flagSeen.has(k)) continue
    flagSeen.add(k)
    flags.push({ ...f, field: '*' })
  }
  if (!autoDisplayFixes.length && !flags.length) return null
  return { version: 'n1-v1', autoDisplayFixes, flags }
}

/** rawMeta JSON에 검수 결과 병합(없으면 키 제거). 결과가 같으면 입력 문자열 그대로 반환. */
export function mergePlaceNameSpellingReviewIntoRawMeta(
  rawMeta: string | null | undefined,
  review: PlaceNameSpellingReview | null,
): string {
  const base = String(rawMeta ?? '')
  let obj: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(base || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) obj = parsed as Record<string, unknown>
    else return base
  } catch {
    return base
  }
  const prev = obj.placeNameSpellingReview
  if (!review) {
    if (prev === undefined) return base
    delete obj.placeNameSpellingReview
    return JSON.stringify(obj)
  }
  if (JSON.stringify(prev) === JSON.stringify(review)) return base
  obj.placeNameSpellingReview = review
  return JSON.stringify(obj)
}

export function parsePlaceNameSpellingReviewFromRawMeta(rawMeta: string | null | undefined): PlaceNameSpellingReview | null {
  try {
    const o = JSON.parse(String(rawMeta ?? '') || '{}') as Record<string, unknown>
    const r = o?.placeNameSpellingReview as PlaceNameSpellingReview | undefined
    return r && r.version === 'n1-v1' ? r : null
  } catch {
    return null
  }
}
