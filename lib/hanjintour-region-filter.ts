/**
 * 한진관광은 기존 7곳(hanatour·modetour·ybtour·naeiltour·lottetour·verygoodtour·kyowontour)에 없는 지역 상품만 수집한다.
 * 목록 단계 정보(분류 경로·상품명)로 도시 단위 대조 → 선정/제외/판단보류. 제외·판단보류 상품은 상세 호출하지 않는다.
 * REGRESSION-FREEZE[hanjintour-region-filter]: 기존 공급사 지역 상품 상세 수집 금지·도시 단위 우선·애매하면 판단보류 — manifest
 */

export const HANJINTOUR_EXISTING_SUPPLIERS = [
  'hanatour',
  'modetour',
  'ybtour',
  'naeiltour',
  'lottetour',
  'verygoodtour',
  'kyowontour',
] as const

/** 표기 차이 묶음 — 첫 값이 대표 표기. kind: city(도시·지역) | country(국가) */
const PLACE_GROUPS: Array<{ kind: 'city' | 'country'; names: string[] }> = [
  ...(
    [
      ['도쿄', '동경'], ['오사카'], ['교토'], ['나라'], ['고베'], ['와카야마'], ['시라하마'], ['나고야'], ['고마쓰', '고마츠'],
      ['알펜루트', '다테야마'], ['홋카이도', '북해도'], ['삿포로'], ['후라노'], ['비에이'], ['하코다테'], ['아사히카와'], ['쿠시로', '구시로'],
      ['오타루'], ['노보리베츠', '노보리베쓰'], ['오이타'], ['후쿠오카'], ['벳푸'], ['유후인'], ['구마모토'], ['나가사키'], ['가고시마'],
      ['미야자키'], ['기타큐슈'], ['야마구치'], ['요나고'], ['오카야마'], ['돗토리'], ['히로시마'], ['시즈오카'], ['이즈'], ['아타미'],
      ['하코네'], ['후지산'], ['니가타'], ['아오모리'], ['아키타'], ['센다이'], ['야마가타'], ['하나마키'], ['오키나와'], ['이시가키'],
      ['미야코지마'], ['다카마쓰', '다카마츠'], ['나오시마'], ['마쓰야마', '마츠야마'], ['도야마'], ['가나자와'], ['시라카와고'],
      ['칭다오', '청도'], ['옌타이', '연태'], ['웨이하이', '위해'], ['다롄', '대련'], ['샤먼', '하문'], ['푸저우', '복주'], ['구이린', '계림'],
      ['구이양', '귀양'], ['장자제', '장가계'], ['시안', '서안'], ['청두', '성도'], ['주자이거우', '구채구'], ['장강삼협', '삼협'], ['쿤밍', '곤명'],
      ['리장', '여강'], ['상하이', '상해'], ['베이징', '북경'], ['톈진', '천진'], ['난징', '남경'], ['허페이', '합비'], ['정저우', '정주'],
      ['타이항산', '태항산'], ['황산'], ['항저우', '항주'], ['쑤저우', '소주'], ['광저우'], ['선전', '심천'], ['하이난', '해남도'], ['싼야', '삼아'],
      ['백두산', '장백산'], ['내몽고', '내몽골'], ['티베트', '라싸'], ['실크로드'], ['둔황', '돈황'], ['우루무치'], ['천저우', '침주'],
      ['홍콩'], ['마카오'], ['타이베이', '타이페이'], ['타이중'], ['가오슝', '까오슝'], ['화롄', '화련'], ['울란바토르'], ['테를지'], ['고비사막', '고비'],
      ['다낭'], ['호이안'], ['나트랑', '냐짱', '나짱'], ['달랏'], ['퀴논', '꾸이년'], ['푸꾸옥', '푸쿠옥'], ['하노이'], ['하롱베이', '하롱'],
      ['사파'], ['호치민', '호찌민'], ['방콕'], ['파타야'], ['푸껫', '푸켓'], ['치앙마이'], ['치앙라이'], ['끄라비', '크라비'], ['발리'], ['마나도'],
      ['싱가포르', '싱가폴'], ['세부'], ['보홀'], ['보라카이'], ['마닐라'], ['클락'], ['코타키나발루', '코타키나바루'], ['쿠알라룸푸르'], ['랑카위'],
      ['페낭'], ['브루나이'], ['비엔티안'], ['루앙프라방'], ['방비엥'], ['씨엠립', '시엠립', '앙코르와트'], ['프놈펜'],
      ['로스앤젤레스', '엘에이'], ['라스베이거스', '라스베가스'], ['샌프란시스코'], ['그랜드캐니언', '그랜드캐년'], ['요세미티'], ['뉴욕'],
      ['워싱턴'], ['보스턴'], ['애틀랜타'], ['나이아가라'], ['밴쿠버'], ['밴프', '캐나디안로키', '로키'], ['캘거리'], ['토론토'],
      ['퀘벡', '퀘백'], ['몬트리올'], ['옐로나이프'], ['화이트호스'], ['하와이', '호놀룰루', '와이키키', '오아후'], ['마우이'], ['빅아일랜드'],
      ['괌'], ['사이판'], ['시드니'], ['브리즈번'], ['골드코스트'], ['멜버른', '멜번'], ['케언즈', '케언스'], ['퀸스타운'], ['오클랜드'],
      ['크라이스트처치'], ['로토루아'], ['피지', '난디'], ['타히티', '보라보라'], ['몰타'], ['시칠리아'], ['아이슬란드'], ['그린란드'],
      ['알래스카'], ['남극'], ['지중해'], ['카리브해'], ['쿠바'], ['파리'], ['런던'], ['로마'], ['베네치아', '베니스'], ['피렌체'], ['밀라노'],
      ['인터라켄'], ['융프라우'], ['프라하'], ['비엔나', '빈'], ['부다페스트'], ['두브로브니크'], ['자그레브'], ['류블랴나'], ['블레드'],
      ['바르셀로나'], ['마드리드'], ['리스본'], ['포르투'], ['산토리니'], ['아테네'], ['이스탄불'], ['카파도키아'], ['카이로'], ['룩소르'],
      ['페트라'], ['트빌리시'], ['예레반'], ['바쿠'], ['타슈켄트'], ['사마르칸트'], ['알마티'], ['오슬로'], ['베르겐'], ['코펜하겐'],
      ['헬싱키'], ['스톡홀름'], ['탈린'], ['리가'], ['빌뉴스'], ['로바니에미'], ['트롬쇠'], ['케이프타운'], ['빅토리아폭포'], ['세렝게티'],
      ['마사이마라'], ['킬리만자로'], ['우유니'], ['마추픽추'], ['쿠스코'], ['이과수'], ['칸쿤'], ['카트만두'], ['팀푸'], ['델리'], ['아그라'],
      ['자이푸르'], ['콜롬보'],
    ] as string[][]
  ).map((names) => ({ kind: 'city' as const, names })),
  ...(
    [
      ['일본'], ['중국'], ['대만'], ['몽골'], ['베트남'], ['태국'], ['인도네시아'], ['필리핀'], ['말레이시아'], ['라오스'], ['캄보디아'],
      ['인도'], ['네팔'], ['부탄'], ['스리랑카'], ['미국'], ['캐나다'], ['멕시코'], ['페루'], ['볼리비아'], ['칠레'], ['아르헨티나'],
      ['브라질'], ['호주'], ['뉴질랜드'], ['영국'], ['프랑스'], ['스위스'], ['이탈리아'], ['네덜란드'], ['벨기에'], ['룩셈부르크'],
      ['체코'], ['오스트리아'], ['헝가리'], ['독일'], ['크로아티아'], ['슬로베니아'], ['루마니아'], ['불가리아'], ['폴란드'], ['노르웨이'],
      ['덴마크'], ['핀란드'], ['스웨덴'], ['에스토니아'], ['라트비아'], ['리투아니아'], ['스페인'], ['포르투갈'], ['모로코'], ['이집트'],
      ['그리스'], ['터키', '튀르키예'], ['요르단'], ['튀니지'], ['케냐'], ['탄자니아'], ['짐바브웨'], ['보츠와나'], ['잠비아'],
      ['남아공', '남아프리카공화국'], ['조지아', '그루지야'], ['아르메니아'], ['아제르바이잔'], ['우즈베키스탄'], ['카자흐스탄'],
      ['키르기스스탄'], ['아랍에미리트', 'uae'], ['두바이'], ['이스라엘'], ['오만'], ['카타르'],
    ] as string[][]
  ).map((names) => ({ kind: 'country' as const, names })),
]

/** 상품명에서 뽑으면 오인이 잦은 짧은 표기 — 분류 경로에서만 인정 */
const CATEGORY_ONLY = new Set(['나라', '인도', '이즈', '하롱', '로키', '빈', '고비', '클락', '리가'])

export function normalizePlaceToken(s: string): string {
  return s.replace(/\s+/g, '').replace(/[·.]/g, '').toLowerCase()
}

type PlaceInfo = { canonical: string; kind: 'city' | 'country' }
const ALIAS = new Map<string, PlaceInfo>()
for (const g of PLACE_GROUPS) for (const n of g.names) ALIAS.set(normalizePlaceToken(n), { canonical: g.names[0]!, kind: g.kind })

export function canonicalPlace(raw: string): PlaceInfo | null {
  return ALIAS.get(normalizePlaceToken(raw)) ?? null
}

/** "홋카이도(북해도)", "청도/연태/대련", "밴프(로키)" → 개별 표기 */
export function splitPlaceLabel(label: string): string[] {
  const out: string[] = []
  for (const part of label.split(/[\/,·&+]|\s>\s/)) {
    const m = part.match(/^([^()]*)\(([^)]*)\)\s*$/)
    if (m) {
      if (m[1]!.trim()) out.push(m[1]!.trim())
      for (const x of m[2]!.split(/[\/,]/)) if (x.trim()) out.push(x.trim())
    } else if (part.trim()) out.push(part.trim())
  }
  return out
}

const TITLE_TOKENS = [...ALIAS.keys()].filter((k) => !CATEGORY_ONLY.has(k) && /[가-힣]/.test(k) && k.length >= 2).sort((a, b) => b.length - a.length)

/** 상품명 속 지명(긴 표기 먼저, 찾은 부분은 지워서 '인도네시아'→'인도' 같은 중복 인식 방지) */
export function placesInText(text: string): PlaceInfo[] {
  let s = normalizePlaceToken(text.replace(/#[^\s#]+/g, (h) => ` ${h.slice(1)} `))
  const found: PlaceInfo[] = []
  for (const t of TITLE_TOKENS) {
    if (!s.includes(t)) continue
    found.push(ALIAS.get(t)!)
    s = s.split(t).join(' ')
  }
  return dedupePlaces(found)
}

function dedupePlaces(xs: PlaceInfo[]): PlaceInfo[] {
  const m = new Map<string, PlaceInfo>()
  for (const x of xs) m.set(x.canonical, x)
  return [...m.values()]
}

export type ExistingProductRegionRow = {
  originSource: string
  country?: string | null
  city?: string | null
  primaryDestination?: string | null
  destinationRaw?: string | null
  destination?: string | null
  title?: string | null
  city_tags?: string[] | null
  city_keys?: string[] | null
  country_tags?: string[] | null
  master_city?: string | null
}

export type ExistingRegionIndex = {
  has: (canonical: string) => boolean
  suppliers: (canonical: string) => string[]
  size: () => number
}

/** 기존 7곳 상품의 지역 색인 (분류·태그·목적지·상품명 지명 모두) */
export function buildExistingRegionIndex(
  rows: ExistingProductRegionRow[],
  cities: Array<{ cityKey: string; koreanLabel: string }> = [],
): ExistingRegionIndex {
  const allowed = new Set<string>(HANJINTOUR_EXISTING_SUPPLIERS)
  const cityLabel = new Map(cities.map((c) => [c.cityKey, c.koreanLabel]))
  const idx = new Map<string, Set<string>>()
  const add = (raw: string | null | undefined, sup: string) => {
    for (const part of splitPlaceLabel(String(raw ?? ''))) {
      const p = canonicalPlace(part)
      const key = p?.canonical ?? normalizePlaceToken(part)
      if (!key) continue
      if (!idx.has(key)) idx.set(key, new Set())
      idx.get(key)!.add(sup)
    }
  }
  for (const r of rows) {
    const sup = String(r.originSource ?? '')
    if (!allowed.has(sup)) continue
    for (const t of r.city_tags ?? []) add(t, sup)
    for (const k of r.city_keys ?? []) add(cityLabel.get(k), sup)
    for (const t of r.country_tags ?? []) add(t, sup)
    add(r.master_city, sup)
    add(r.city, sup)
    add(r.primaryDestination, sup)
    add(r.destinationRaw, sup)
    add(r.destination, sup)
    for (const p of placesInText([r.title, r.destinationRaw, r.primaryDestination].filter(Boolean).join(' '))) {
      if (!idx.has(p.canonical)) idx.set(p.canonical, new Set())
      idx.get(p.canonical)!.add(sup)
    }
  }
  return {
    has: (c) => (idx.get(c)?.size ?? 0) > 0,
    suppliers: (c) => [...(idx.get(c) ?? [])].sort(),
    size: () => idx.size,
  }
}

export type HanjintourListingForRegion = { gdsNo: string; title: string; categoryPaths: string[][] }

export type HanjintourRegionDecision = {
  decision: '선정' | '제외' | '판단보류'
  places: string[]
  newPlaces: string[]
  existingPlaces: Array<{ place: string; suppliers: string[] }>
  basis: string
}

const DOMESTIC_HINT = /호캉스|제주|서울|경기|강원|경상|전라|충청|부산|국내/

/**
 * 분류 경로 [권역, 국가, 도시…] + 상품명 지명으로 판단.
 * 핵심 지명 = 상품명 지명 + 지명 하나짜리 분류명. '상해/황산/합비/남경' 같은 묶음 분류명은 메뉴 묶음이라 핵심으로 보지 않는다.
 * - 핵심 도시 중 기존 7곳에 없는 곳이 있으면 선정, 모두 있으면 제외
 * - 핵심 도시가 없으면 핵심 국가로: 없는 국가가 있으면 선정, 모두 있으면 제외(국가 단위 판단임을 근거에 표기)
 * - 핵심 지명이 없고 묶음 분류명만 있으면: 묶음 지명이 모두 기존이면 제외, 아니면 판단보류(어느 도시를 가는지 모름)
 * - 지명을 하나도 못 읽으면 판단보류
 */
export function classifyHanjintourListing(it: HanjintourListingForRegion, index: ExistingRegionIndex): HanjintourRegionDecision {
  const core: PlaceInfo[] = []
  const grouped: PlaceInfo[] = []
  const unknownLeaf: string[] = []
  for (const path of it.categoryPaths) {
    const rest = path.slice(1)
    rest.forEach((label, i) => {
      const recognized = dedupePlaces(splitPlaceLabel(label).map(canonicalPlace).filter((p): p is PlaceInfo => p != null))
      if (recognized.length === 0) {
        if (i === rest.length - 1 && label.trim()) unknownLeaf.push(label.trim())
        return
      }
      ;(recognized.length === 1 ? core : grouped).push(...recognized)
    })
  }
  core.push(...placesInText(it.title))
  const coreList = dedupePlaces(core)
  const coreCities = coreList.filter((p) => p.kind === 'city')
  const coreCountries = coreList.filter((p) => p.kind === 'country')
  const groupList = dedupePlaces(grouped).filter((g) => !coreList.some((c) => c.canonical === g.canonical))
  const places = [...coreList, ...groupList].map((p) => p.canonical)
  const existingPlaces = places.filter((p) => index.has(p)).map((p) => ({ place: p, suppliers: index.suppliers(p) }))
  const missing = (xs: PlaceInfo[]) => xs.filter((p) => !index.has(p.canonical)).map((p) => p.canonical)
  const withSup = (xs: PlaceInfo[]) => xs.map((p) => `${p.canonical}(${index.suppliers(p.canonical).join('/')})`).join(', ')

  if (coreCities.length > 0) {
    const n = missing(coreCities)
    if (n.length > 0) return { decision: '선정', places, newPlaces: n, existingPlaces, basis: `기존 7곳에 없는 도시: ${n.join('·')}` }
    return { decision: '제외', places, newPlaces: [], existingPlaces, basis: `핵심 도시 모두 기존 공급사에 있음: ${withSup(coreCities)}` }
  }
  const groupCities = groupList.filter((p) => p.kind === 'city')
  if (coreCountries.length > 0) {
    const n = missing(coreCountries)
    if (n.length > 0) return { decision: '선정', places, newPlaces: n, existingPlaces, basis: `기존 7곳에 없는 국가: ${n.join('·')} (도시 표기 없음)` }
    const gn = missing(groupCities)
    if (gn.length > 0) {
      return {
        decision: '판단보류',
        places,
        newPlaces: [],
        existingPlaces,
        basis: `국가는 기존에 있으나 묶음 분류 도시(${groupCities.map((p) => p.canonical).join('/')}) 중 ${gn.join('·')}는 기존에 없음 — 상품명에 방문 도시 없음`,
      }
    }
    return { decision: '제외', places, newPlaces: [], existingPlaces, basis: `도시 표기 없음 — 국가 단위로 모두 기존에 있음: ${withSup(coreCountries)}` }
  }
  if (groupList.length > 0) {
    const n = missing(groupList)
    if (n.length === 0) return { decision: '제외', places, newPlaces: [], existingPlaces, basis: `묶음 분류 지명 모두 기존에 있음: ${withSup(groupList)}` }
    return {
      decision: '판단보류',
      places,
      newPlaces: [],
      existingPlaces,
      basis: `묶음 분류(${groupList.map((p) => p.canonical).join('/')})에 기존 없는 지명 ${n.join('·')} 있으나 상품명에 방문 도시 없음`,
    }
  }
  const domestic = [...unknownLeaf, ...it.categoryPaths.flat()].some((s) => DOMESTIC_HINT.test(s))
  return {
    decision: '판단보류',
    places,
    newPlaces: [],
    existingPlaces,
    basis: `${domestic ? '국내 상품 추정 — ' : ''}지명 인식 불가${unknownLeaf.length ? ` (분류명 '${unknownLeaf.join('/')}')` : ''}`,
  }
}

/** 상세·출발일·가격 호출 허용 여부 — 선정 상품만 */
export function hanjintourDetailCollectAllowed(d: HanjintourRegionDecision): boolean {
  return d.decision === '선정'
}
