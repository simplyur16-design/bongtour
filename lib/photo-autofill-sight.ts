/**
 * 사진 자동 채움 — 그날 실제 방문 명소 추출(순수 함수, 네트워크·DB 없음).
 * - 검색어는 도시 이름이 아니라 그날 일정에 나온 명소(영문 명칭 우선).
 * - 도시 이름만 있는 키워드는 명소가 아니다. 일정에 없는 도시가 들어간 낡은 키워드는 버린다.
 * - 별칭 사전(SIGHT_ALIAS_GROUPS)으로 같은 명소의 다른 표기를 같은 명소로 본다.
 * REGRESSION-FREEZE[photo-autofill-sight]: 명소 추출·도시만 탈락·별칭 일치 — manifest
 */
import { englishFromScheduleKoreanSegmentWithRegex, findAllScheduleSpotMatchesInText, scheduleSpotRulesMatchingKeyword } from '@/lib/schedule-poi-regex-ssot'
import { PLACE_NAMES } from '@/lib/register-photo-match-gate'

export function foldPhotoText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 같은 명소의 다른 이름(영문·현지·한글). 모두 소문자·악센트 제거 형태로 비교한다. */
export const SIGHT_ALIAS_GROUPS: ReadonlyArray<readonly string[]> = [
  ['blue mosque', 'sultan ahmed mosque', 'sultanahmet mosque', 'sultanahmet camii', '블루모스크'],
  ['hagia sophia', 'aya sofya', 'ayasofya', '아야소피아'],
  ['wat saket', 'golden mount', 'golden mountain', 'phu khao thong', '왓사켓'],
  ['wat pho', 'temple of the reclining buddha', 'reclining buddha', '왓포'],
  ['wat arun', 'temple of dawn', '왓아룬'],
  ['grand palace', 'grand palace bangkok', 'royal grand palace', '왕궁'],
  ['matsuyama castle', 'matsuyama jo', '마쓰야마성'],
  ['dragon bridge', 'cau rong', '용다리'],
  ['golden bridge', 'cau vang', 'golden hands bridge', 'hand bridge', 'giant hands bridge', '골든브릿지'],
  ['marble mountains', 'ngu hanh son', '마블마운틴'],
  ['han market', 'cho han'],
  ['charles bridge', 'karluv most', '카를교'],
  ['old town square', 'staromestske namesti', 'prague old town square', '구시가지 광장'],
  ['cesky krumlov', 'krumlov', '체스키크룸로프'],
  ['prague castle', 'hradcany', 'prazsky hrad', '프라하성'],
  ['plitvice lakes', 'plitvice', 'plitvicka jezera', 'plitvice lakes national park', '플리트비체'],
  ['dubrovnik city walls', 'walls of dubrovnik', 'dubrovnik walls', 'dubrovnik old town walls', '두브로브니크 성벽'],
  ['church of st donatus', 'st donatus church', 'saint donatus', 'sveti donat', '성 도나트 성당'],
  ['zagreb cathedral', 'cathedral of the assumption zagreb', 'zagreb cathedral of the assumption'],
  ['jokulsarlon', 'jokulsarlon glacier lagoon', 'glacier lagoon', 'diamond beach'],
  ['reynisfjara', 'reynisfjara black sand beach', 'black sand beach iceland'],
  ['nyhavn', '뉘하운'],
  ['doi suthep', 'wat phra that doi suthep', '도이수텝'],
  ['doi inthanon', 'doi inthanon national park', '도이인타논'],
  ['serengeti', 'serengeti national park'],
  ['masai mara', 'maasai mara'],
  ['victoria falls', '빅토리아폭포'],
  ['jungfraujoch', 'top of europe', '융프라우요흐'],
  ['mount rigi', 'rigi', 'rigi kulm', 'mt rigi', '리기산'],
  ['grossmunster', 'grossmunster zurich', 'grossmunster church'],
  ['tumon bay', 'tumon beach'],
  ['penglai pavilion', 'penglai', '봉래각'],
  ['gamcheon culture village', 'gamcheon village', 'gamcheon', '감천문화마을'],
  ['eiffel tower', 'tour eiffel', '에펠탑'],
  ['mount fuji', 'mt fuji', 'fuji san', 'fujisan', '후지산'],
  ['golden whip stream', 'golden whip', 'jinbianxi', 'jinbian creek', '금편계'],
  ['arakurayama sengen', 'arakurayama sengen park', 'chureito pagoda', 'chureito', '아라쿠라야마'],
  ['otaru music box museum', 'otaru music box', 'otaru orgel', '오타루 오르골', '오르골당'],
  ['marseille old port', 'vieux port', 'old port of marseille', 'vieux port marseille'],
  ['cours mirabeau', 'aix en provence cours mirabeau'],
  ['valensole', 'valensole lavender', 'valensole plateau'],
  ['gordes', 'village of gordes'],
]

const GENERIC_NOUNS = new Set([
  'castle', 'temple', 'mosque', 'bridge', 'mountain', 'mountains', 'mount', 'lake', 'lakes', 'beach', 'park', 'palace', 'cathedral',
  'church', 'tower', 'square', 'market', 'falls', 'waterfall', 'waterfalls', 'national', 'wall', 'walls', 'village', 'bay', 'island',
  'river', 'garden', 'gardens', 'museum', 'street', 'gate', 'harbor', 'harbour', 'port', 'hill', 'hills', 'valley', 'canyon', 'cliff',
  'cliffs', 'glacier', 'lagoon', 'cave', 'pagoda', 'shrine', 'fortress', 'fort', 'station', 'avenue', 'road', 'center', 'centre',
  'pavilion', 'plateau', 'railway', 'cogwheel', 'observatory', 'cruise', 'old', 'town', 'city', 'lagoon', 'basilica', 'monastery',
])
const STOP_TOKENS = new Set([
  'the', 'of', 'and', 'in', 'at', 'on', 'de', 'la', 'le', 'el', 'del', 'di', 'da', 'du', 'des', 'a', 'an', 'to',
  'dawn', 'night', 'sunset', 'sunrise', 'view', 'views', 'scenic', 'landscape', 'skyline', 'aerial', 'panorama', 'day', 'morning', 'evening',
  'tour', 'trip', 'travel', 'photo', 'visit',
])
const WEAK_ADJ = new Set([
  'blue', 'golden', 'grand', 'royal', 'white', 'black', 'red', 'green', 'great', 'little', 'big', 'imperial', 'sacred', 'holy',
  'upper', 'lower', 'central', 'north', 'south', 'east', 'west', 'new', 'marble', 'main', 'first', 'second', 'sweet',
])

/**
 * 고유명 뒤에 붙는 설명 낱말(사진 설명에 잘 안 나온다). 고유명 낱말 대조·축약 검색어에서 뺀다.
 * REGRESSION-FREEZE[photo-sight-core-1127]: 고유명 낱말 대조는 설명 낱말을 필수로 두지 않는다 — manifest
 */
const DESCRIPTOR_TOKENS = new Set([
  'columns', 'column', 'pillars', 'ruins', 'interior', 'exterior', 'facade', 'entrance', 'courtyard', 'hall', 'halls', 'statue', 'statues',
  'zipline', 'jungle', 'hopping', 'snorkeling', 'snorkel', 'diving', 'kayak', 'kayaking', 'rafting', 'trekking', 'hiking', 'trail', 'boat',
  'cable', 'car', 'ropeway', 'gondola', 'train', 'tram', 'floating', 'sea', 'ocean', 'coast', 'coastline', 'shore', 'reef', 'coral', 'forest',
  'heaven', 'crater', 'caldera', 'volcano', 'peak', 'summit', 'turquoise', 'water', 'waters', 'hot', 'spring', 'springs', 'show', 'performance',
  'lights', 'lantern', 'lanterns', 'flowers', 'flower', 'blossom', 'blossoms', 'autumn', 'winter', 'summer', 'spring', 'snow', 'fog', 'mist',
  'rice', 'terraces', 'terrace', 'tea', 'plantation', 'farm', 'vineyard', 'vineyards', 'ancient', 'historic', 'heritage', 'traditional',
  'onsen', 'viewpoint', 'observation', 'deck', 'walk', 'walking', 'stroll', 'district', 'quarter', 'alley', 'alleys', 'buildings', 'building',
])
const CORE_MIN_SINGLE = 5

const CITY_EXTRA = [
  'switzerland', 'swiss', 'italy', 'france', 'spain', 'croatia', 'czech', 'czechia', 'austria', 'hungary', 'poland', 'germany', 'turkey',
  'turkiye', 'greece', 'egypt', 'japan', 'china', 'vietnam', 'thailand', 'laos', 'cambodia', 'malaysia', 'indonesia', 'philippines',
  'mongolia', 'kazakhstan', 'uzbekistan', 'kenya', 'tanzania', 'zimbabwe', 'zambia', 'botswana', 'iceland', 'denmark', 'provence',
  'tuscany', 'europe', 'africa', 'asia', 'america', 'usa', 'canada', 'mexico', 'peru', 'brazil', 'australia', 'korea', 'taiwan',
  'india', 'nepal', 'qingdao', 'copenhagen', 'reykjavik', 'lyon', 'marseille', 'zagreb', 'zadar', 'dubrovnik',
  'ulaanbaatar', 'almaty', 'tashkent', 'astana', 'nairobi', 'johannesburg',
]
const CITY_TOKENS: Set<string> = (() => {
  const out = new Set<string>()
  for (const names of Object.values(PLACE_NAMES)) {
    for (const n of names) {
      if (/[가-힣]/.test(n)) continue
      for (const t of foldPhotoText(n).split(' ')) if (t.length >= 3) out.add(t)
    }
  }
  for (const t of CITY_EXTRA) out.add(t)
  return out
})()

function isCityToken(t: string): boolean {
  return CITY_TOKENS.has(t)
}

export type SightKind = 'sight' | 'generic' | 'city' | 'empty'

export type SightProfile = {
  name: string
  kind: SightKind
  /** 별칭 사전 + 전체 구절 — 이 중 하나가 후보 글에 구절로 있으면 일치 */
  phraseTerms: string[]
  /** 이름의 핵심 낱말 모두가 후보 글에 있으면 일치(순서 무관) */
  requiredTokens: string[]
  /** kind=generic 일 때 후보 글에 같이 있어야 하는 도시 낱말 */
  needsCityAnchor: boolean
  /** 고유명 낱말(일반 명사·설명 낱말·도시 제외). 모두 있으면 일치 — 한 낱말이면 5자 이상만 */
  coreTokens?: string[]
}

/** 이름에서 고유명 낱말만(일반 명사·흔한 형용사·설명 낱말·도시·불용어 제외), 앞에서 2개까지 */
export function sightCoreTokens(nameRaw: string): string[] {
  const head = sightCoreQuery(nameRaw) || String(nameRaw ?? '')
  const toks = foldPhotoText(head)
    .split(' ')
    .filter((t) => t && !STOP_TOKENS.has(t) && !GENERIC_NOUNS.has(t) && !WEAK_ADJ.has(t) && !DESCRIPTOR_TOKENS.has(t) && !isCityToken(t))
    .filter((t) => !/^\d+$/.test(t) && !/[가-힣]/.test(t))
  const core = toks.slice(0, 2)
  if (core.length === 1 && core[0]!.length < CORE_MIN_SINGLE) return []
  if (core.length === 2 && core.every((t) => t.length < 3)) return []
  return core
}

/**
 * 고유명 축약 검색어: 설명 낱말·도시를 떼고 고유명 + 바로 뒤 일반 명사 1개(Karnak Temple Luxor Columns → Karnak Temple).
 * 원래 이름과 같으면 ''.
 * REGRESSION-FREEZE[photo-sight-core-1127]: 긴 키워드는 고유명 축약 검색어를 더한다 — manifest
 */
export function sightCoreQuery(nameRaw: string): string {
  const words = String(nameRaw ?? '').trim().split(/\s+/).filter(Boolean)
  const out: string[] = []
  let strong = 0
  for (const w of words) {
    const f = foldPhotoText(w)
    if (!f) continue
    if (STOP_TOKENS.has(f) && out.length === 0) continue
    if (DESCRIPTOR_TOKENS.has(f) || (isCityToken(f) && out.length > 0)) break
    if (isCityToken(f)) continue
    const isNoun = GENERIC_NOUNS.has(f)
    if (isNoun && out.length > 0) {
      out.push(w)
      break
    }
    if (!isNoun && !WEAK_ADJ.has(f) && !STOP_TOKENS.has(f)) strong++
    out.push(w)
    if (out.length >= 3) break
  }
  if (strong === 0) return ''
  const q = out.join(' ').trim()
  return foldPhotoText(q) === foldPhotoText(nameRaw) ? '' : q
}

function aliasGroupOf(folded: string): readonly string[] | null {
  for (const g of SIGHT_ALIAS_GROUPS) {
    const members = g.map(foldPhotoText)
    if (members.includes(folded)) return members
  }
  for (const g of SIGHT_ALIAS_GROUPS) {
    const members = g.map(foldPhotoText)
    if (members.some((m) => m.length >= 5 && ` ${folded} `.includes(` ${m} `))) return members
  }
  return null
}

export function sightProfile(nameRaw: string): SightProfile {
  const name = String(nameRaw ?? '').trim()
  const folded = foldPhotoText(name)
  const empty: SightProfile = { name, kind: 'empty', phraseTerms: [], requiredTokens: [], needsCityAnchor: false }
  if (!folded || /^day \d+$/.test(folded)) return empty
  const tokens = folded.split(' ').filter((t) => !STOP_TOKENS.has(t))
  const alias = aliasGroupOf(folded)
  if (tokens.length === 0) return empty
  const nonCity = tokens.filter((t) => !isCityToken(t))
  const strong = nonCity.filter((t) => !GENERIC_NOUNS.has(t) && !WEAK_ADJ.has(t))
  if (!alias && nonCity.length === 0) return { ...empty, kind: 'city' }
  if (!alias && strong.length === 0 && nonCity.every((t) => GENERIC_NOUNS.has(t)) && nonCity.length <= 2 && !nonCity.some((t) => !GENERIC_NOUNS.has(t))) {
    // 'old town square' 처럼 일반 명사만 → 도시 낱말이 같이 있어야 일치
    return { name, kind: 'generic', phraseTerms: [folded], requiredTokens: nonCity, needsCityAnchor: true }
  }
  const head = strong.slice(0, 2)
  const nouns = nonCity.filter((t) => GENERIC_NOUNS.has(t) && !['old', 'town', 'city', 'national', 'mount'].includes(t))
  let required: string[]
  if (head.length >= 2) required = head
  else if (head.length === 1) required = head[0]!.length >= 6 && nouns.length === 0 ? head : [...head, ...nouns.slice(0, 1)]
  else required = nonCity.filter((t) => !['old', 'town', 'city', 'national'].includes(t)).slice(0, 2)
  if (alias) return { name, kind: 'sight', phraseTerms: [...new Set([folded, ...alias])].filter(Boolean), requiredTokens: required.length >= 2 || (required.length === 1 && required[0]!.length >= 4) ? required : [], needsCityAnchor: false, coreTokens: sightCoreTokens(name) }
  if (required.length === 0 || (required.length === 1 && required[0]!.length < 4)) return empty
  const phrases = new Set<string>([folded, ...(alias ?? [])])
  const weakOnly = strong.length === 0
  return {
    name,
    kind: weakOnly && !alias ? 'generic' : 'sight',
    phraseTerms: [...phrases],
    requiredTokens: required,
    needsCityAnchor: weakOnly && !alias,
    ...(weakOnly ? {} : { coreTokens: sightCoreTokens(name) }),
  }
}

export function sightMatchInText(profile: SightProfile, textRaw: string, anchorTermsRaw: readonly string[] = []): string | null {
  if (profile.kind === 'empty' || profile.kind === 'city') return null
  const text = ` ${foldPhotoText(textRaw)} `
  if (!text.trim()) return null
  const anchorOk = () => {
    if (!profile.needsCityAnchor) return true
    return anchorTermsRaw.map(foldPhotoText).filter(Boolean).some((a) => text.includes(` ${a} `))
  }
  const anchored = () => anchorTermsRaw.map(foldPhotoText).filter(Boolean).some((a) => text.includes(` ${a} `))
  for (const p of profile.phraseTerms) {
    if (!p || !text.includes(` ${p} `)) continue
    // 일반 명사·흔한 형용사로만 이루어진 이름(blue mosque, old town square)은 같은 이름 다른 도시가 많아 도시 낱말이 같이 있어야 한다
    const distinctive = p.split(' ').some((w) => w && !STOP_TOKENS.has(w) && !GENERIC_NOUNS.has(w) && !WEAK_ADJ.has(w) && !isCityToken(w))
    if (anchorOk() && (distinctive || anchored())) return p
  }
  const toks = profile.requiredTokens
  // 낱말만 맞는 일치(구절 아님)는 두 낱말 이하면 도시 낱말이 같이 있어야 한다(aurora village 같은 흔한 이름).
  // 명소 이름에 들어 있는 도시(오타루 오르골, 가와구치코)는 상품 대표 도시(하코다테·시즈오카)와 달라도 앵커가 된다.
  const namedCity = foldPhotoText(profile.name)
    .split(' ')
    .filter((t) => isCityToken(t))
    .some((t) => text.includes(` ${t} `))
  if (toks.length > 0 && toks.every((t) => text.includes(` ${t} `)) && anchorOk() && (toks.length >= 3 || anchored() || namedCity)) return toks.join('+')
  // REGRESSION-FREEZE[photo-sight-core-1127]: 고유명 낱말(설명·일반어 제외)이 모두 있으면 일치 — 한 낱말은 5자 이상, 6자 미만은 도시 앵커 필요 — manifest
  // 다른 장소·인물·흑백·용량·중복은 이 뒤 관문이 그대로 본다.
  const core = profile.kind === 'sight' ? (profile.coreTokens ?? []) : []
  if (core.length > 0 && core.every((t) => text.includes(` ${t} `)) && (core.length >= 2 || core[0]!.length >= CORE_MIN_SINGLE)) {
    if (core.length >= 2 || core[0]!.length >= 6 || anchored() || namedCity) return `core:${core.join('+')}`
  }
  return null
}

export function isCityOnlySight(name: string): boolean {
  return sightProfile(name).kind === 'city'
}

export type DaySightInput = {
  title?: string | null
  routeText?: string | null
  description?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
  /** 그날 공급사 원문 일정 조각(supplierOriginal.items) — 고유명 판정에 함께 본다 */
  supplierText?: string | null
  /** 다른 일차의 일정 글(제목·경로·설명·원문) — 다른 일차 명소 키워드를 거르는 데만 쓴다 */
  otherDaysText?: string | null
}

type ScheduleRowLike = { day?: unknown; title?: unknown; routeText?: unknown; description?: unknown; supplierOriginal?: unknown } | null | undefined

const ISLAND_PREFIX_TOKENS = new Set(['koh', 'ko', 'pulau', 'nusa', 'isla', 'ilha'])
/** 그날 명소 판정용 겹침: 같은 구절이거나, 일반어·묘사어·섬 접두어(koh)를 뺀 낱말이 겹칠 때만 */
const TRAVEL_ONLY_SENTENCE_RE =
  /[^.!?\n·]*(?:에서\s*출발(?:해|하여|후)?\s*(?:[^.!?\n·]{0,30}?(?:으로|로|에)\s*)?(?:귀국|도착)|(?:으로|로)\s*귀국)[^.!?\n·]*[.!?]?/gu
/** 이동만 말하는 문장(출발·귀국·도착)은 그날 방문 근거에서 뺀다 */
export function stripTravelOnlySentences(text: string): string {
  return String(text ?? '')
    .replace(TRAVEL_ONLY_SENTENCE_RE, ' ')
    .replace(/[가-힣A-Za-z]+(?:\s*[-–]\s*[가-힣A-Za-z]+)*\s*고속도로/gu, ' ')
}

export function ownDayOverlap(a: SightProfile, b: SightProfile): boolean {
  if (a.phraseTerms.some((p) => b.phraseTerms.includes(p))) return true
  const strong = (t: string) => !GENERIC_NOUNS.has(t) && !DESCRIPTOR_TOKENS.has(t) && !ISLAND_PREFIX_TOKENS.has(t)
  const bs = new Set(b.requiredTokens.filter(strong))
  return a.requiredTokens.filter(strong).some((t) => bs.has(t))
}

/** 원문에서 맞은 글자가 도시 이름뿐인지(홍콩·호이안) — 도시 대표 명소 규칙은 '그날 명소' 근거가 아니다 */
/** 사전 규칙이 명소로 바꾸지만 일정 글에서는 도시·지역 이름으로만 쓰이는 낱말(장가계→국립삼림공원, 시즈오카→후지산) */
const EXTRA_KOREAN_CITY_WORDS = ['장가계', '시즈오카', '상해', '상하이', '하노이', '다낭', '파타야', '방콕', '싱가포르', '칭다오', '고베', '교토', '나라', '오사카', '후쿠오카']
/** 사전에서 명소처럼 다루지만 키워드로는 도시 이름뿐인 영문(Kobe·Nara) — 도시만 키워드로 버린다 */
const EXTRA_CITY_ONLY_KEYWORDS_EN = new Set(['kobe', 'kyoto', 'nara', 'osaka', 'fukuoka', 'shanghai', 'zhangjiajie', 'shizuoka', 'da nang', 'danang', 'pattaya', 'bangkok', 'singapore', 'qingdao', 'hanoi'])
export function isBareCityMatchText(t: string | null | undefined): boolean {
  const k = String(t ?? '').replace(/\s+/g, '')
  if (!k) return false
  if (EXTRA_KOREAN_CITY_WORDS.includes(k)) return true
  return Object.values(PLACE_NAMES).some((names) => names.some((n) => n.replace(/\s+/g, '').toLowerCase() === k.toLowerCase()))
}

const KOREAN_CITY_WORDS: string[] = [...new Set([...Object.values(PLACE_NAMES).flat(), ...EXTRA_KOREAN_CITY_WORDS].filter((n) => /^[가-힣]+$/.test(n)))].sort((a, b) => b.length - a.length)
/** '마카오와 홍콩을 둘러봅니다' 처럼 홀로 쓴 도시 이름(조사 포함)은 지운다. '오사카성'처럼 이름 일부는 그대로 */
export function stripStandaloneKoreanCityWords(seg: string): string {
  let out = ` ${seg} `
  for (const c of KOREAN_CITY_WORDS) {
    out = out.replace(new RegExp(`(^|[\\s,.!?·()_\\-])${c}(?:와|과|을|를|은|는|에서|에|의|도|로|으로)?(?=$|[\\s,.!?·()_\\-])`, 'g'), '$1')
  }
  for (const c of EXTRA_CITY_ONLY_KEYWORDS_EN) {
    out = out.replace(new RegExp(`(^|[\\s,.!?·()_\\-])${c}(?=$|[\\s,.!?·()_\\-])`, 'gi'), '$1')
  }
  return out.replace(/\s+/g, ' ').trim()
}

/** 일정 행의 공급사 원문 조각(supplierOriginal.items[].name/text) */
export function scheduleRowSupplierText(row: ScheduleRowLike): string {
  const so = row && typeof row === 'object' ? (row as { supplierOriginal?: unknown }).supplierOriginal : null
  const items = so && typeof so === 'object' ? (so as { items?: unknown }).items : null
  if (!Array.isArray(items)) return ''
  // REGRESSION-FREEZE[photo-keyword-own-day-1127]: 이름 없는 짧은 줄('하롱베이 - 하노이', '다자이후 이동')은 지역 머리글·이동 메모라 방문 근거가 아니다 — manifest
  return items
    .filter((i) => {
      if (!i || typeof i !== 'object') return false
      const name = (i as { name?: unknown }).name
      const text = (i as { text?: unknown }).text
      const header = !(typeof name === 'string' && name.trim()) && typeof text === 'string' && text.trim().length <= 25 && !/[.!?]/.test(text)
      return !header
    })
    .map((i) => (i && typeof i === 'object' ? [(i as { name?: unknown }).name, (i as { text?: unknown }).text] : []))
    .flat()
    .filter((x): x is string => typeof x === 'string')
    .join(' ')
}

/** 이 일차를 뺀 나머지 일차의 일정 글 — 다른 일차 명소 키워드 판정용 */
export function scheduleOtherDaysText(rows: ReadonlyArray<ScheduleRowLike>, day: number): string {
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return rows
    .filter((r) => r && Number((r as { day?: unknown }).day) !== day)
    .map((r) => [str(r!.title), str(r!.routeText), str(r!.description), scheduleRowSupplierText(r)].join(' '))
    .join(' ')
}

export type DaySightResult = {
  sights: string[]
  reason: 'ok' | 'no_sight' | 'city_only' | 'keyword_conflict'
  /** 일정에서 찾은 도시(영문) — 검색어 보강·도시 앵커용 */
  cityTerms: string[]
  rejectedKeywords: Array<{ keyword: string; why: 'city_only' | 'other_city' | 'not_in_route' | 'weak' }>
}

function cityKeysIn(textFolded: string, includeKorean: boolean): string[] {
  const out: string[] = []
  const padded = ` ${textFolded} `
  for (const [key, names] of Object.entries(PLACE_NAMES)) {
    const hit = names.some((n) => {
      if (/[가-힣]/.test(n)) return includeKorean && padded.replace(/\s+/g, '').includes(n.replace(/\s+/g, ''))
      return padded.includes(` ${foldPhotoText(n)} `)
    })
    if (hit) out.push(key)
  }
  return out
}

export function sightsOverlap(a: SightProfile, b: SightProfile): boolean {
  if (a.phraseTerms.some((p) => b.phraseTerms.includes(p))) return true
  const bs = new Set(b.requiredTokens)
  return a.requiredTokens.some((t) => bs.has(t) && !GENERIC_NOUNS.has(t))
}

/**
 * 그날 방문 명소 목록(대표 먼저). 일정(동선·제목·설명)에 나온 명소가 근거이고,
 * 일정에 없는 다른 도시가 들어간 낡은 키워드·도시만 있는 키워드는 버린다.
 */
export function deriveDaySights(day: DaySightInput, destinationText = ''): DaySightResult {
  const routeBlob = [day.routeText, day.title, day.description, day.supplierText].map((x) => String(x ?? '')).join(' ')
  // REGRESSION-FREEZE[photo-keyword-own-day-1127]: 'X에서 출발해 귀국/도착' 같은 이동 문장은 방문 근거가 아니다(시즈오카 출발 → 후지산 아님) — manifest
  const ownBlob = stripTravelOnlySentences(routeBlob)
  const otherBlob = String(day.otherDaysText ?? '')
  const slotFolded = foldPhotoText(`${routeBlob} ${destinationText}`)
  const allowedCities = new Set(cityKeysIn(slotFolded, true))
  const rejected: DaySightResult['rejectedKeywords'] = []

  // 도시 이름(장가계·시즈오카)만 지운 글 — 키워드 '그날 명소' 확인용
  const ownBlobNoCity = stripStandaloneKoreanCityWords(ownBlob)
  const spots: string[] = []
  const seen = new Set<string>()
  // REGRESSION-FREEZE[photo-keyword-own-day-1127]: 도시 이름만 맞은 명소(장가계→국립삼림공원)는 그날 고유 명소 뒤 — manifest
  const ownHits = findAllScheduleSpotMatchesInText(ownBlob)
  for (const hit of [...ownHits.filter((h) => !isBareCityMatchText(h.text)), ...ownHits.filter((h) => isBareCityMatchText(h.text))]) {
    const k = foldPhotoText(hit.en)
    if (!k || seen.has(k)) continue
    seen.add(k)
    spots.push(hit.en)
  }
  const spotProfiles = spots.map(sightProfile).filter((p) => p.kind === 'sight' || p.kind === 'generic')
  // REGRESSION-FREEZE[photo-keyword-own-day-1127]: 도시 이름만 맞은 규칙(홍콩→Victoria Harbour)은 키워드 '그날 명소' 판정에서 뺀다 — manifest
  const ownNamedSpotProfiles = findAllScheduleSpotMatchesInText(ownBlob)
    .filter((h) => !isBareCityMatchText(h.text))
    .map((h) => sightProfile(h.en))
    .filter((p) => p.kind === 'sight' || p.kind === 'generic')
  const segProfiles = (text: string) =>
    text
      .split(/[·•,，、\/|>→\-–—()\[\]{}~+&\n]+/)
      .map((x) => x.trim())
      .filter((x) => x && /[가-힣]/.test(x) && !isBareCityMatchText(x))
      .slice(0, 80)
      .map((seg) => stripStandaloneKoreanCityWords(seg))
      .filter((seg) => /[가-힣]/.test(seg))
      .map((seg) => {
        try {
          return englishFromScheduleKoreanSegmentWithRegex(seg)
        } catch {
          return ''
        }
      })
      .filter(Boolean)
      .map(sightProfile)
      .filter((p) => p.kind === 'sight' || p.kind === 'generic')
  const ownSegProfiles = segProfiles(ownBlob)
  let otherSegCache: SightProfile[] | null = null
  const otherSegProfiles = () => (otherSegCache ??= otherBlob ? segProfiles(otherBlob).filter((p) => !ownSegProfiles.some((q) => sightsOverlap(p, q))) : [])
  const otherSpotProfiles = otherBlob
    ? findAllScheduleSpotMatchesInText(otherBlob)
        .map((h) => sightProfile(h.en))
        .filter((p) => (p.kind === 'sight' || p.kind === 'generic') && !spotProfiles.some((q) => sightsOverlap(p, q)))
    : []

  const keywordSights: string[] = []
  const lateKeywordSights: string[] = []
  for (const raw of [day.imageKeyword, day.imageKeyword2]) {
    const kw = String(raw ?? '').trim()
    if (!kw || /^day[_ ]?\d+$/i.test(kw)) continue
    const prof = sightProfile(kw)
    if (prof.kind === 'city' || prof.kind === 'empty' || EXTRA_CITY_ONLY_KEYWORDS_EN.has(foldPhotoText(kw).trim())) {
      rejected.push({ keyword: kw, why: prof.kind === 'empty' ? 'weak' : 'city_only' })
      continue
    }
    const kwCities = cityKeysIn(foldPhotoText(kw), false)
    if (kwCities.some((c) => !allowedCities.has(c))) {
      rejected.push({ keyword: kw, why: 'other_city' })
      continue
    }
    // REGRESSION-FREEZE[photo-keyword-own-day-1127]: 키워드는 그날 원문 일정의 고유명만(PHOTO-RULES 키워드).
    // 그날 글(사전·한→영 조각·원문)로 확인되면 맨 앞. 그날 글에 없는 게 확인되면(다른 일차 글에 있음, 또는 사전 규칙의 한글 이름이 그날 글에 없음 —
    // 도시 대표 명소 팩) 버린다. 확인도 반박도 안 되는 고유명(사전 밖)은 그날 명소 뒤에 둔다 — manifest
    // 같은 고유명 규칙만(도시 이름만 겹치는 넓은 규칙 제외): 영문 이름의 핵심 낱말이 키워드 핵심 낱말과 겹칠 때
    const kwCore = new Set(sightCoreTokens(kw))
    const kwRules = scheduleSpotRulesMatchingKeyword(kw)
      .filter((r) => sightCoreTokens(r.en).some((t) => kwCore.has(t)))
      .map((r) => r.re)
    const onOwnDay =
      ownNamedSpotProfiles.some((p) => ownDayOverlap(prof, p)) ||
      ownSegProfiles.some((p) => ownDayOverlap(prof, p)) ||
      kwRules.some((re) => {
        const m = ownBlobNoCity.match(re)
        return Boolean(m && !isBareCityMatchText(m[0]))
      }) ||
      Boolean(sightMatchInText(prof, ownBlobNoCity))
    if (!onOwnDay) {
      const onOtherDay =
        otherSpotProfiles.some((p) => sightsOverlap(prof, p)) ||
        otherSegProfiles().some((p) => sightsOverlap(prof, p)) ||
        Boolean(otherBlob && (sightMatchInText(prof, otherBlob) || kwRules.some((re) => re.test(otherBlob))))
      const koreanNameMissing = kwRules.some((re) => /[가-힣]/.test(re.source))
      if (onOtherDay || koreanNameMissing) {
        rejected.push({ keyword: kw, why: 'not_in_route' })
        continue
      }
      lateKeywordSights.push(kw)
      continue
    }
    // REGRESSION-FREEZE[photo-day-keyword-fill]: 그날 imageKeyword 명소는 대표만 채우고 일차를 비우지 않는다. 다른 도시 키워드만 버린다 — manifest
    keywordSights.push(kw)
  }

  const ordered: string[] = []
  const orderedSeen = new Set<string>()
  // REGRESSION-FREEZE[photo-keyword-own-day-1127]: 그날 원문 조각의 한→영 명소(사전 정규식 밖, 예 세나도 광장)도 확인 안 된 키워드보다 앞 — manifest
  for (const s of [...keywordSights, ...spots, ...ownSegProfiles.map((p) => p.name), ...lateKeywordSights]) {
    const p = sightProfile(s)
    if (p.kind !== 'sight' && p.kind !== 'generic') continue
    const key = p.phraseTerms[0] ?? foldPhotoText(s)
    if (orderedSeen.has(key) || ordered.some((o) => sightsOverlap(sightProfile(o), p))) continue
    orderedSeen.add(key)
    ordered.push(s)
  }
  const cityTerms = [...allowedCities].flatMap((k) => (PLACE_NAMES[k] ?? []).filter((n) => !/[가-힣]/.test(n))).slice(0, 12)
  if (ordered.length > 0) return { sights: ordered, reason: 'ok', cityTerms, rejectedKeywords: rejected }
  // REGRESSION-FREEZE[photo-title-landmark-1127]: 키워드가 비었거나 도시만이면 그날 일정 제목의 첫 명소(한→영)로 검색만 한다(DB 키워드는 쓰지 않음) — manifest
  const fromTitle = titleFirstLandmarkSight(day.title, allowedCities)
  if (fromTitle) return { sights: [fromTitle], reason: 'ok', cityTerms, rejectedKeywords: rejected }
  const reason: DaySightResult['reason'] = rejected.some((r) => r.why === 'other_city' || r.why === 'not_in_route')
    ? 'keyword_conflict'
    : rejected.some((r) => r.why === 'city_only')
      ? 'city_only'
      : 'no_sight'
  return { sights: [], reason, cityTerms, rejectedKeywords: rejected }
}

const TITLE_NON_SIGHT_RE = /이동|출발|도착|공항|호텔|숙소|자유\s*시간|자유일정|조식|중식|석식|체크인|체크아웃|귀국|인천|휴식|쇼핑|면세/

/** 일정 제목을 구분자로 나눠 첫 명소 조각을 영문 명소 이름으로(사전에 있는 것만). 도시만·다른 도시는 버린다. */
export function titleFirstLandmarkSight(titleRaw: string | null | undefined, allowedCities: ReadonlySet<string> = new Set()): string | null {
  const title = String(titleRaw ?? '').trim()
  if (!title) return null
  const segs = title.split(/[·•,，、\/|>→\-–—()\[\]{}~+&]+|\s및\s/).map((x) => x.trim()).filter(Boolean)
  for (const seg of segs) {
    if (TITLE_NON_SIGHT_RE.test(seg)) continue
    let en = ''
    try {
      en = englishFromScheduleKoreanSegmentWithRegex(seg)
    } catch {
      en = ''
    }
    if (!en || /[가-힣]/.test(en)) continue
    const prof = sightProfile(en)
    if (prof.kind !== 'sight') continue
    const kwCities = cityKeysIn(foldPhotoText(en), false)
    if (allowedCities.size > 0 && kwCities.some((c) => !allowedCities.has(c))) continue
    return en
  }
  return null
}

/**
 * 대표 사진 검색어. 일정 특색 장소를 대표 도시보다 먼저 쓰고, 도시 이름만 있는 검색어는 뺀다.
 * REGRESSION-FREEZE[photo-cover-day-sight]: 대표가 비었으면 일차 명소로 검색 — manifest
 * REGRESSION-FREEZE[thumbnail-least-used-1121]: 일정 특색 장소 우선 — manifest
 */
export function coverSearchSights(heroKeywords: readonly string[], dayKeywords: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of [...dayKeywords, ...heroKeywords]) {
    const name = String(raw ?? '').trim()
    if (!name) continue
    const profile = sightProfile(name)
    if (profile.kind !== 'sight' && profile.kind !== 'generic') continue
    const key = profile.phraseTerms[0] ?? foldPhotoText(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(name)
    if (out.length >= 2) break
  }
  return out
}

/** 검색어: 명소 이름 그대로 → 도시를 덧붙인 것(같은 이름 다른 곳 구분). 최대 2개. */
export function sightSearchQueries(sight: string, cityTerms: readonly string[]): string[] {
  const base = String(sight ?? '').trim().replace(/\s+/g, ' ')
  if (!base) return []
  const out = [base]
  // REGRESSION-FREEZE[photo-sight-core-1127]: 고유명 축약 검색어(설명 낱말 뺀 것)를 도시 덧붙임보다 먼저 — manifest
  const core = sightCoreQuery(base)
  if (core && !out.includes(core)) out.push(core)
  const head = core || base
  const city = cityTerms.find((c) => !foldPhotoText(head).includes(foldPhotoText(c)))
  if (city) out.push(`${head} ${city}`)
  return out.slice(0, 3)
}
