/**
 * 자동 사진 채움 — 후보 최종 관문(순수 함수, 쓰기·네트워크 없음).
 * 문과장 batch-01 검수(10/31): 손목시계·재킷 남성·침실 커플·수술 의사·귀 클로즈업·차량 야경,
 * 다른 나라 명소(금문교·로마·마드리드·베네치아), 봉심 eSIM 홍보, 출처(ID·작가) 없음, AI 표시 없음 → 탈락.
 * 사장님 16:11: 장소가 맞는 풍경·명소 사진만. 출처 순서 Pexels → Unsplash/CC0 → AI(표시 필수).
 *
 * 통과 조건(모두):
 *  ① 가로 1200px 이상(알 때) · 세로 사진은 대표 슬롯에서 탈락
 *  ② 재고 사진은 사진 ID + (작가 또는 원본 주소) 기록 / AI 는 AI 표시 있을 때만
 *  ③ 설명(alt·페이지 주소·풀 이름표)이 있어야 함 — 설명 없으면 장소 확인 불가로 탈락
 *  ④ 사람·인물·의료·차량·사물·실내·침실·홍보물·일정에 없는 동물이 주인공이면 탈락
 *  ⑤ 그 슬롯(일차 장소 / 상품 목적지)과 다른 도시·나라의 명소·도시명이 보이면 탈락
 *  ⑥ 그 슬롯의 장소명 또는 상품 목적지 도시명이 설명에 있어야 함(약한 일치 탈락)
 *  ⑦ (일차) daySummary 가 있으면: 그날 일정 요약(제목·설명)에 실제로 있는 장소만 일치로 인정 —
 *     상품 목적지·검색어라도 그날 요약에 없으면 인정 안 함(문과장 10/31: 중복 피하려다 일정 밖 장소로 넘어가지 않기)
 * 사람: 사장님 10/31 16:29 "사람이 주인공인 사진만 빼고" — 풍경 속 작은 사람·간판은 통과, 사람이 주인공일 때만 탈락
 * 차량: 승용차·승합차·버스가 보이면 탈락. 케이블카·유람선 등은 그날 일정에 있을 때만 예외
 * REGRESSION-FREEZE[register-photo-match-gate]: 장소 일치 + 인물·사물·홍보·타국 명소 탈락 — manifest
 */
import { photoCandidateText, itineraryMentionsAnimal } from '@/lib/register-photo-subject-filter'

export type MatchGateCandidate = {
  altText?: string | null
  pageUrl?: string | null
  /** 풀 이름표·파일 경로 등 */
  label?: string | null
  width?: number | null
  height?: number | null
  photographer?: string | null
  originalLink?: string | null
  externalId?: string | null
  isGenerated?: boolean
  /** AI 이미지의 표시(생성 문장/라벨) — 없으면 AI 후보 탈락 */
  aiLabel?: unknown
}

export type MatchGateContext = {
  /** 이 슬롯 장소(일차 imageKeyword·검색어·일차 도시) — 영문/한글 */
  placeTerms: Array<string | null | undefined>
  /** 상품 목적지(한글 + 영문 매핑) */
  destinationTerms: Array<string | null | undefined>
  /** 이 슬롯 일정 글(제목·동선) + 목적지 — 다른 도시 판정의 허용 범위. 대표는 상품 전체 일정. */
  slotText: string
  slot: 'main' | 'day'
  /** (일차) 그날 일정 요약 — 제목 + 설명(없으면 동선). 있으면 장소 일치는 여기 있는 장소만 인정 */
  daySummary?: string | null
}

export type MatchGateReason =
  | 'low_res'
  | 'portrait_orientation'
  | 'missing_attribution'
  | 'ai_unlabeled'
  | 'no_description'
  | 'person'
  | 'medical'
  | 'vehicle'
  | 'promo'
  | 'unrelated_object'
  | 'interior_not_place'
  | 'animal_not_in_itinerary'
  | 'other_place_landmark'
  | 'city_mismatch'
  | 'no_place_match'

export const MATCH_GATE_MIN_WIDTH = 1200

/** 사람을 가리키는 낱말(이것만으로는 탈락 아님 — 주인공일 때만) */
const PERSON_WORD =
  '(man|men|woman|women|girl|girls|boy|boys|guy|guys|lady|ladies|person|couple|couples|child|children|kid|kids|baby|bride|groom|businessman|businesswoman|vendor|vendors|customer|customers|shopper|shoppers|worker|workers|chef|cook|seller|backpacker|hiker|hikers|fisherman|monk|monks|traveler|traveller|tourist|friends|family|teen|teenager|student|students)'
/** 사람이 주인공임이 분명한 낱말 */
const PERSON_SUBJECT_RE =
  /\b(portrait|portraits|selfie|selfies|headshot|posing|poses|posed|fashion|wedding|bride|groom|model posing|models posing|human ear|human face|facial)\b|\bclose ?up of (a |an |the )?(man|woman|girl|boy|person|face|ear|hand|hands)\b|\b(his|her|their) (face|ear|ears|hair|eyes)\b/
/** 사람 낱말 + 옷차림·동작 묘사 = 사람이 주인공 */
const PERSON_DESC_RE = new RegExp(`\\b${PERSON_WORD}\\b.{0,40}\\b(wearing|wears|dressed|in (a |an |the )?(black|white|red|blue|green|yellow|pink|traditional|stylish|casual)? ?(jacket|dress|gown|robe|coat|suit|shirt|hoodie|hat|kimono|hanbok|ao dai)|holding|smiling|smiles|looking at (the )?camera|lying|sitting on (a |the )?bed|checks|checking|enjoying (a |her |his )?(drink|coffee|meal|food))\\b`)

/**
 * 사람이 주인공인가: 설명 맨 앞 명사구(앞 5낱말)가 사람이거나, 인물 사진 낱말이 있거나, 사람+옷차림·동작 묘사.
 * 'People walk past the Ruins of St. Paul's'·'Prague Castle with tourists on the bridge' 처럼 풍경 속 사람은 통과.
 * 간판(sign)은 사유가 아님.
 */
export function personIsMainSubject(altLower: string): boolean {
  const t = ` ${altLower.replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim()} `
  if (PERSON_SUBJECT_RE.test(t)) return true
  if (PERSON_DESC_RE.test(t)) return true
  const head = t.trim().split(' ').slice(0, 5).join(' ')
  const lead = new RegExp(`^(a |an |the |two |three |young |old |elderly |smiling |happy |asian |beautiful |stylish |pretty |handsome |cheerful |senior |little |small )*${PERSON_WORD}\\b`)
  return lead.test(head)
}
const MEDICAL_RE = /\b(surgeon|surgeons|surgery|surgical|doctor|doctors|nurse|nurses|hospital|medical|patient|clinic|dentist|operating|operation|scrubs|stethoscope)\b/
const VEHICLE_RE =
  /\b(car|cars|vehicle|vehicles|van|vans|minivan|bus|buses|truck|trucks|suv|jeep|motorcycle|motorbike|motorbikes|scooter|scooters|taxi|taxis|traffic|parked|parking|supercar|sportscar|airplane|aeroplane|aircraft|airliner|jet|runway|airport|street scene|busy street|busy road)\b/
const PROMO_RE = /\b(esim|e sim|sim card|promo|promotion|advertisement|advert|banner|logo|coupon|discount|sale|bongsim|flag|flags|poster|mockup|infographic)\b|봉심|이심/
const OBJECT_RE =
  /\b(watch|watches|wristwatch|clock|phone|smartphone|laptop|keyboard|camera|passport|luggage|suitcase|ticket|jewelry|jewellery|necklace|ring|sneaker|sneakers|shoe|shoes|handbag|perfume|lipstick|headphones|charger|monstera|hay|letters|figurine|prop|statuette)\b/
const INTERIOR_RE =
  /\b(hallway|corridor|interior|indoor|indoors|room|bedroom|bed|beds|pillow|sofa|couch|bathtub|lobby|office|bookstore|bookshop|library|bookshelf|shelf|shelves|mall|escalator|kitchen|bathroom)\b/
const ANIMAL_RE =
  /\b(elephant|elephants|tiger|tigers|lion|monkey|monkeys|dog|dogs|cat|cats|bird|birds|horse|horses|camel|camels|panda|pandas|deer|cow|cows|snake|dolphin|whale|bear|bears)\b/

/** 관광 수단 — 그날(대표는 상품) 일정에 그 수단이 있을 때만 차량으로 보지 않음 */
const VEHICLE_EXEMPT: ReadonlyArray<[RegExp, RegExp]> = [
  [/\b(cable car|cable cars|ropeway|gondola|gondolas)\b/g, /케이블카|로프웨이|곤돌라|cable car|ropeway|gondola/],
  [/\b(tram|trams|streetcar)\b/g, /트램|노면전차|tram/],
  [/\b(funicular)\b/g, /푸니쿨라|푸니쿨러|산악열차|funicular/],
  [/\b(train|trains|railway)\b/g, /기차|열차|산악열차|train|railway/],
  [/\b(boat|boats|cruise|ferry|ferries|raft|bamboo raft)\b/g, /유람선|크루즈|보트|페리|뗏목|배|cruise|boat|ferry/],
  [/\b(cyclo)\b/g, /씨클로|시클로|cyclo/],
]

/** 명소 → 소속 도시/나라 키 (다른 곳 상품에 보이면 탈락) */
export const LANDMARK_HOME: ReadonlyArray<[RegExp, string]> = [
  [/\bgolden gate\b/, 'san francisco'],
  [/\b(eiffel|louvre|champs elysees|arc de triomphe|montmartre|sacre coeur)\b/, 'paris'],
  [/\b(colosseum|colosseo|trevi|vatican|st peter s basilica|vittoriano|sant angelo|pantheon rome|spanish steps|roman forum)\b/, 'rome'],
  [/\b(rialto|st mark s|san marco|doge s palace|doges palace|grand canal venice|venetian)\b/, 'venice'],
  [/\b(milan cathedral|duomo di milano|galleria vittorio)\b/, 'milan'],
  [/\b(sagrada familia|park guell|casa batllo|la rambla)\b/, 'barcelona'],
  [/\b(cibeles|gran via|plaza mayor|puerta del sol|royal palace of madrid)\b/, 'madrid'],
  [/\b(big ben|tower bridge|london eye|buckingham|westminster)\b/, 'london'],
  [/\b(statue of liberty|times square|brooklyn bridge|central park|empire state)\b/, 'new york'],
  [/\b(opera house|harbour bridge|bondi)\b/, 'sydney'],
  [/\b(burj khalifa|burj al arab)\b/, 'dubai'],
  [/\b(marina bay sands|merlion)\b/, 'singapore'],
  [/\btaipei 101\b/, 'taipei'],
  [/\bpetronas\b/, 'kuala lumpur'],
  [/\b(gyeongbokgung|gyeongbok|bukchon)\b/, 'seoul'],
  [/\b(gamcheon)\b/, 'busan'],
  [/\b(fushimi inari|kinkaku|kiyomizu|arashiyama)\b/, 'kyoto'],
  [/\b(kawaguchiko|mount fuji|mt fuji)\b/, 'fuji'],
  [/\b(ginzan)\b/, 'yamagata'],
  [/\b(ho chi minh mausoleum|hoan kiem|ba dinh)\b/, 'hanoi'],
  [/\b(wat arun|asiatique|talat noi|khao san|wat pho)\b/, 'bangkok'],
  [/\b(west lake|xihu)\b/, 'hangzhou'],
  [/\b(lichen|licheń)\b/, 'poland'],
  [/\b(balaton)\b/, 'hungary'],
  [/\b(cinque terre|amalfi|positano)\b/, 'italy'],
  [/\b(tobago)\b/, 'tobago'],
  [/\b(waikiki)\b/, 'honolulu'],
  [/\b(santorini|oia)\b/, 'santorini'],
  [/\b(mae hong son|ban rak thai)\b/, 'mae hong son'],
  [/\b(stone forest|shilin)\b/, 'kunming'],
  [/\b(vang vieng)\b/, 'vang vieng'],
  [/\b(blue lagoon iceland)\b/, 'iceland'],
  [/\b(christ the redeemer|sugarloaf|copacabana)\b/, 'rio de janeiro'],
  [/\b(cusco|plaza de armas cusco)\b/, 'cusco'],
  [/\b(kapellbrucke|chapel bridge)\b/, 'lucerne'],
  [/\b(abu simbel)\b/, 'abu simbel'],
  [/\b(el jem)\b/, 'el jem'],
]

/** 도시·나라 키 → 허용 판정에 쓰는 이름(영문·한글) */
export const PLACE_NAMES: Record<string, string[]> = {
  'san francisco': ['san francisco', '샌프란시스코'], paris: ['paris', '파리', '프랑스'], rome: ['rome', 'roma', '로마', '바티칸'],
  venice: ['venice', 'venezia', '베네치아', '베니스'], milan: ['milan', 'milano', '밀라노'], barcelona: ['barcelona', '바르셀로나'],
  madrid: ['madrid', '마드리드'], london: ['london', '런던'], 'new york': ['new york', '뉴욕', '맨해튼', '맨하탄'], sydney: ['sydney', '시드니'],
  dubai: ['dubai', '두바이'], singapore: ['singapore', '싱가포르', '싱가폴'], taipei: ['taipei', '타이베이', '타이페이'],
  'kuala lumpur': ['kuala lumpur', '쿠알라룸푸르'], seoul: ['seoul', '서울'], busan: ['busan', '부산'], kyoto: ['kyoto', '교토'],
  fuji: ['fuji', '후지', '가와구치코'], yamagata: ['yamagata', '긴잔', '야마가타'], hanoi: ['hanoi', '하노이'], bangkok: ['bangkok', '방콕'],
  hangzhou: ['hangzhou', '항주', '항저우', '서호'], poland: ['poland', '폴란드'], hungary: ['hungary', '헝가리', '부다페스트'],
  italy: ['italy', '이탈리아'], tobago: ['tobago', '토바고'], honolulu: ['honolulu', 'waikiki', '호놀룰루', '와이키키'],
  santorini: ['santorini', '산토리니'], 'mae hong son': ['mae hong son', '매홍손'], kunming: ['kunming', '곤명', '쿤밍', '석림'],
  'vang vieng': ['vang vieng', '방비엥'], iceland: ['iceland', '아이슬란드', '블루라군'], 'rio de janeiro': ['rio de janeiro', '리우'],
  cusco: ['cusco', 'cuzco', '쿠스코'], lucerne: ['lucerne', 'luzern', '루체른'], 'abu simbel': ['abu simbel', '아부심벨'], 'el jem': ['el jem', '엘젬'],
  osaka: ['osaka', '오사카'], tokyo: ['tokyo', '도쿄'], 'da nang': ['da nang', 'danang', '다낭'], 'hoi an': ['hoi an', '호이안'],
  pattaya: ['pattaya', '파타야'], 'ho chi minh': ['ho chi minh', 'saigon', '호치민'], florence: ['florence', 'firenze', '피렌체'],
  prague: ['prague', 'praha', '프라하'], vienna: ['vienna', 'wien', '비엔나'], budapest: ['budapest', '부다페스트'], istanbul: ['istanbul', '이스탄불'],
  'hong kong': ['hong kong', '홍콩'], macau: ['macau', 'macao', '마카오'], shanghai: ['shanghai', '상해', '상하이'], beijing: ['beijing', '북경', '베이징'],
  sapporo: ['sapporo', '삿포로', '삿포'], fukuoka: ['fukuoka', '후쿠오카'], guilin: ['guilin', '계림', '구이린'], 'las vegas': ['las vegas', '라스베가스', '라스베이거스'],
  lisbon: ['lisbon', 'lisboa', '리스본'], otaru: ['otaru', '오타루'], taihang: ['taihang', '태항산', '태항'], manado: ['manado', '마나도'],
  'phu quoc': ['phu quoc', '푸꾸옥', '푸국'], 'nha trang': ['nha trang', '나트랑', '나짱'], zhangjiajie: ['zhangjiajie', '장가계'], cappadocia: ['cappadocia', '카파도키아'],
  yangshuo: ['yangshuo', '양삭', '양숴'], malacca: ['malacca', 'melaka', '말라카'], melaka: ['melaka', 'malacca', '말라카'], penang: ['penang', '페낭'], 'ba na hills': ['ba na hills', '바나힐', '바나산'], hokkaido: ['hokkaido', '홋카이도'], cebu: ['cebu', '세부'], bali: ['bali', '발리'],
  guam: ['guam', '괌'], saipan: ['saipan', '사이판'], cairo: ['cairo', '카이로'], giza: ['giza', '기자'], athens: ['athens', '아테네'], seville: ['seville', 'sevilla', '세비야'], zurich: ['zurich', '취리히'], 'chiang mai': ['chiang mai', '치앙마이'],
}
/** 설명에 도시명이 나오면 그 도시가 슬롯 허용 범위에 있어야 함 */
const CITY_KEYS_FOR_MISMATCH = [
  'san francisco', 'paris', 'rome', 'venice', 'milan', 'florence', 'barcelona', 'madrid', 'lisbon', 'seville', 'london', 'new york', 'las vegas',
  'sydney', 'dubai', 'singapore', 'taipei', 'kuala lumpur', 'seoul', 'busan', 'kyoto', 'tokyo', 'osaka', 'sapporo', 'fukuoka', 'hanoi', 'ho chi minh',
  'da nang', 'hoi an', 'bangkok', 'pattaya', 'chiang mai', 'hangzhou', 'shanghai', 'beijing', 'guilin', 'hong kong', 'macau', 'prague', 'vienna',
  'budapest', 'istanbul', 'zurich', 'lucerne', 'honolulu', 'malacca', 'melaka', 'penang', 'otaru', 'sapporo', 'yangshuo', 'manado', 'phu quoc', 'nha trang',
] as const

const GENERIC = new Set([
  'the', 'and', 'of', 'in', 'at', 'on', 'day', 'tour', 'city', 'old', 'town', 'night', 'view', 'park', 'street', 'market', 'temple', 'beach', 'hill',
  'hills', 'mountain', 'mountains', 'lake', 'river', 'island', 'national', 'bay', 'island', 'tower', 'bridge', 'palace', 'castle', 'church', 'cathedral',
  'museum', 'garden', 'gardens', 'square', 'scenic', 'landscape', 'travel', 'photo', 'stock', 'free', 'image', 'pexels', 'unsplash', 'with', 'from',
  'landmark', 'skyline', 'sunset', 'sunrise', 'area', 'district', 'road', 'center', 'centre', 'north', 'south', 'east', 'west', 'great', 'big', 'new',
])

function low(s: unknown): string {
  return String(s ?? '').toLowerCase()
}
function padded(s: string): string {
  return ` ${s.replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()} `
}

/** 슬롯 장소·목적지에서 의미 있는 영문/한글 토큰 */
export function matchGateTerms(values: Array<string | null | undefined>): string[] {
  const out = new Set<string>()
  for (const v of values) {
    const t = low(v).trim()
    if (!t) continue
    if (t.length >= 3 && !GENERIC.has(t)) out.add(t)
    for (const tok of t.split(/[^\p{L}\p{N}]+/u)) {
      if (!tok || GENERIC.has(tok)) continue
      if (/^[a-z0-9]+$/.test(tok) ? tok.length >= 4 : tok.length >= 2) out.add(tok)
    }
  }
  return [...out]
}

/**
 * 장소 일치: 장소명(여러 단어면 전체 구절) 또는 목적지·일차 도시명이 그대로 있어야 한다.
 * 단어 일부만 맞는 약한 일치('Grand World' 의 world, 'Ruins of St. Paul's' 를 말라카 성 바울 성당에)는 탈락
 * 한글 장소명은 풀 이름표(label)에서만 본다.
 */
/** 한글 장소명(목적지·일차 도시) → PLACE_NAMES 의 영문 이름을 덧붙인다 ('구이린' → guilin) */
export function expandPlaceValues(values: Array<string | null | undefined>): string[] {
  const out: string[] = []
  for (const v of values) {
    const raw = low(v).trim()
    if (!raw) continue
    out.push(raw)
    if (!/[가-힣]/.test(raw)) continue
    const compact = raw.replace(/\s+/g, '')
    for (const [key, names] of Object.entries(PLACE_NAMES)) {
      if (names.some((n) => /[가-힣]/.test(n) && compact.includes(n.replace(/\s+/g, '')))) out.push(...names.filter((n) => !/[가-힣]/.test(n)), key)
    }
  }
  return [...new Set(out)]
}

export function placeHit(text: string, label: string, valuesIn: Array<string | null | undefined>): string | null {
  for (const v of expandPlaceValues(valuesIn)) {
    const raw = low(v).trim()
    if (!raw) continue
    if (/[가-힣]/.test(raw)) {
      const k = raw.replace(/\s+/g, '')
      if (k.length >= 2 && label.replace(/\s+/g, '').includes(k)) return raw
      continue
    }
    const phrase = padded(raw).trim()
    if (!phrase || GENERIC.has(phrase)) continue
    if (text.includes(` ${phrase} `) || (phrase.includes(' ') && text.replace(/\s+/g, '').includes(phrase.replace(/\s+/g, '')))) return phrase
  }
  return null
}

/**
 * 일차 장소 일치에 쓸 이름: 그날 요약(제목·설명)에 실제로 있는 장소만.
 *  - 요약의 한글 도시·명소명 → 영문 이름(PLACE_NAMES)
 *  - 일차 키워드·목적지는 그 안의 도시명이 요약에 있을 때만(도시명이 없는 명소 키워드 'Grand World' 는 그대로)
 *  - 예: 오타루 일차(삿포로 상품) → otaru 만, 'Sapporo brewery' 는 no_place_match
 */
export function dayPlaceTerms(ctx: MatchGateContext): string[] {
  const summary = low(ctx.daySummary).trim()
  if (!summary) return []
  const compact = summary.replace(/\s+/g, '')
  const out = new Set<string>()
  for (const v of expandPlaceValues([summary])) if (v !== summary) out.add(v)
  const cityKeysIn = (v: string) => Object.entries(PLACE_NAMES).filter(([, names]) => names.some((n) => !/[가-힣]/.test(n) && padded(v).includes(` ${n} `))).map(([k]) => k)
  const inSummary = (key: string) => out.has(key) || (PLACE_NAMES[key] ?? []).some((n) => /[가-힣]/.test(n) && compact.includes(n.replace(/\s+/g, '')))
  for (const raw of [...ctx.placeTerms, ...ctx.destinationTerms]) {
    const v = low(raw).trim()
    if (!v) continue
    if (/[가-힣]/.test(v)) {
      const k = v.replace(/\s+/g, '')
      if (k.length >= 2 && compact.includes(k)) out.add(v)
      continue
    }
    const keys = cityKeysIn(v)
    if (keys.length === 0 ? !ctx.destinationTerms.includes(raw) : keys.every(inSummary)) out.add(v)
  }
  return [...out]
}

const SCENE_RE =
  /\b(aerial|panorama|panoramic|skyline|landscape|cityscape|view|vista|scenic|temple|castle|bridge|mountain|mountains|canal|ruins|cathedral|basilica|mosque|pagoda|old town|beach|bay|harbor|harbour|coast|river|lake|valley|canyon|waterfall|palace|tower|square|karst|island|sunset|sunrise)\b/g
const CROWD_RE = /\b(people|crowd|crowds|tourists|visitors|street food|shop|store|display|market stall)\b/

/**
 * 관문 통과 후보끼리 고르는 점수: 일차 장소명 일치 > 목적지 도시만 일치, 풍경·명소 단어, 1920px+, 사람 많은 장면 감점.
 * 높을수록 먼저. (rankPhotosByScore 앞에서 정렬 키로 쓴다)
 */
export function matchGateScore(c: MatchGateCandidate, ctx: MatchGateContext): number {
  const t = padded(photoCandidateText([c.altText, c.pageUrl, c.label]))
  let s = 0
  const pt = ctx.slot === 'day' && ctx.daySummary != null ? dayPlaceTerms(ctx) : ctx.placeTerms
  if (placeHit(t, padded(low(c.label)), pt)) s += 4
  else if (placeHit(t, padded(low(c.label)), ctx.destinationTerms)) s += 1
  s += Math.min(3, (t.match(SCENE_RE) ?? []).length)
  if (Number(c.width ?? 0) >= 1920) s += 1
  if (CROWD_RE.test(t)) s -= 2
  return s
}

export function photoMatchGate(c: MatchGateCandidate, ctx: MatchGateContext): { ok: boolean; reason: MatchGateReason | null; matched: string | null } {
  const no = (reason: MatchGateReason) => ({ ok: false, reason, matched: null })
  const w = Number(c.width ?? 0)
  const h = Number(c.height ?? 0)
  if (w > 0 && w < MATCH_GATE_MIN_WIDTH) return no('low_res')
  if (ctx.slot === 'main' && w > 0 && h > w) return no('portrait_orientation')
  if (c.isGenerated) {
    if (!c.aiLabel) return no('ai_unlabeled')
  } else {
    const has = (v: unknown) => String(v ?? '').trim() !== ''
    if (!has(c.externalId) || !(has(c.photographer) || has(c.originalLink))) return no('missing_attribution')
  }
  const raw = photoCandidateText([c.altText, c.pageUrl, c.label])
  const t = padded(raw.replace(/\b(pexels|unsplash|photo|photos|free|stock|image|webp|jpe?g|png|https?|www|com|\d+)\b/g, ' '))
  if (!c.isGenerated && t.trim().length < 3) return no('no_description')
  const slotHay = padded(low([ctx.slotText, ...ctx.placeTerms, ...ctx.destinationTerms].join(' ')))
  let tv = t
  for (const [en, ko] of VEHICLE_EXEMPT) if (ko.test(low(ctx.slotText))) tv = tv.replace(en, ' ')
  if (MEDICAL_RE.test(t)) return no('medical')
  if (personIsMainSubject(t)) return no('person')
  if (PROMO_RE.test(t)) return no('promo')
  if (VEHICLE_RE.test(tv)) return no('vehicle')
  // '삿포로 시계탑' 처럼 일정에 있는 시계탑은 사물(시계)로 보지 않음
  const to = /시계탑|clock tower/.test(low(ctx.slotText)) ? t.replace(/\bclock tower(s)?\b/g, ' ') : t
  if (OBJECT_RE.test(to)) return no('unrelated_object')
  if (INTERIOR_RE.test(t)) return no('interior_not_place')
  const animal = ANIMAL_RE.exec(t)?.[1]
  if (animal && !itineraryMentionsAnimal(slotHay, animal)) return no('animal_not_in_itinerary')
  const allowed = (key: string) => (PLACE_NAMES[key] ?? [key]).some((n) => slotHay.includes(` ${n} `) || slotHay.includes(n.replace(/\s+/g, '')) || (/[가-힣]/.test(n) && slotHay.includes(n)))
  for (const [re, home] of LANDMARK_HOME) if (re.test(t) && !allowed(home)) return no('other_place_landmark')
  for (const city of CITY_KEYS_FOR_MISMATCH) if (t.includes(` ${city} `) && !allowed(city)) return no('city_mismatch')
  const terms = ctx.slot === 'day' && ctx.daySummary != null ? dayPlaceTerms(ctx) : [...ctx.placeTerms, ...ctx.destinationTerms]
  const hit = placeHit(t, padded(low(c.label)), terms)
  if (!hit && !c.isGenerated) return no('no_place_match')
  return { ok: true, reason: null, matched: hit ?? null }
}

/** 이미 품질 순으로 정렬된 후보를 관문 점수로 다시 정렬(같은 점수면 원래 순서 유지) */
export function sortByMatchGateScore<T extends { altText?: string | null; pageUrl?: string | null; originalLink?: string | null; width?: number | null; height?: number | null }>(
  cands: readonly T[],
  ctx: MatchGateContext
): T[] {
  return cands
    .map((c, i) => ({ c, i, s: matchGateScore({ altText: c.altText, pageUrl: c.pageUrl ?? c.originalLink, width: c.width, height: c.height }, ctx) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c)
}
