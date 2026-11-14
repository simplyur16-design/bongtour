/**
 * 사진 자동 채움 — 그날 실제 방문 명소 추출(순수 함수, 네트워크·DB 없음).
 * - 검색어는 도시 이름이 아니라 그날 일정에 나온 명소(영문 명칭 우선).
 * - 도시 이름만 있는 키워드는 명소가 아니다. 일정에 없는 도시가 들어간 낡은 키워드는 버린다.
 * - 별칭 사전(SIGHT_ALIAS_GROUPS)으로 같은 명소의 다른 표기를 같은 명소로 본다.
 * REGRESSION-FREEZE[photo-autofill-sight]: 명소 추출·도시만 탈락·별칭 일치 — manifest
 */
import { findAllScheduleSpotMatchesInText } from '@/lib/schedule-poi-regex-ssot'
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
  if (alias) return { name, kind: 'sight', phraseTerms: [...new Set([folded, ...alias])].filter(Boolean), requiredTokens: required.length >= 2 || (required.length === 1 && required[0]!.length >= 4) ? required : [], needsCityAnchor: false }
  if (required.length === 0 || (required.length === 1 && required[0]!.length < 4)) return empty
  const phrases = new Set<string>([folded, ...(alias ?? [])])
  const weakOnly = strong.length === 0
  return {
    name,
    kind: weakOnly && !alias ? 'generic' : 'sight',
    phraseTerms: [...phrases],
    requiredTokens: required,
    needsCityAnchor: weakOnly && !alias,
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
  for (const p of profile.phraseTerms) {
    if (p && text.includes(` ${p} `) && anchorOk()) return p
  }
  const toks = profile.requiredTokens
  if (toks.length > 0 && toks.every((t) => text.includes(` ${t} `)) && anchorOk()) return toks.join('+')
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

function overlap(a: SightProfile, b: SightProfile): boolean {
  if (a.phraseTerms.some((p) => b.phraseTerms.includes(p))) return true
  const bs = new Set(b.requiredTokens)
  return a.requiredTokens.some((t) => bs.has(t) && !GENERIC_NOUNS.has(t))
}

/**
 * 그날 방문 명소 목록(대표 먼저). 일정(동선·제목·설명)에 나온 명소가 근거이고,
 * 일정에 없는 다른 도시가 들어간 낡은 키워드·도시만 있는 키워드는 버린다.
 */
export function deriveDaySights(day: DaySightInput, destinationText = ''): DaySightResult {
  const routeBlob = [day.routeText, day.title, day.description].map((x) => String(x ?? '')).join(' ')
  const slotFolded = foldPhotoText(`${routeBlob} ${destinationText}`)
  const allowedCities = new Set(cityKeysIn(slotFolded, true))
  const rejected: DaySightResult['rejectedKeywords'] = []

  const spots: string[] = []
  const seen = new Set<string>()
  for (const hit of findAllScheduleSpotMatchesInText(routeBlob)) {
    const k = foldPhotoText(hit.en)
    if (!k || seen.has(k)) continue
    seen.add(k)
    spots.push(hit.en)
  }
  const spotProfiles = spots.map(sightProfile).filter((p) => p.kind === 'sight' || p.kind === 'generic')

  const keywordSights: string[] = []
  for (const raw of [day.imageKeyword, day.imageKeyword2]) {
    const kw = String(raw ?? '').trim()
    if (!kw || /^day[_ ]?\d+$/i.test(kw)) continue
    const prof = sightProfile(kw)
    if (prof.kind === 'city' || prof.kind === 'empty') {
      rejected.push({ keyword: kw, why: prof.kind === 'city' ? 'city_only' : 'weak' })
      continue
    }
    const kwCities = cityKeysIn(foldPhotoText(kw), false)
    if (kwCities.some((c) => !allowedCities.has(c))) {
      rejected.push({ keyword: kw, why: 'other_city' })
      continue
    }
    if (spotProfiles.length > 0 && !spotProfiles.some((s) => overlap(prof, s))) {
      rejected.push({ keyword: kw, why: 'not_in_route' })
      continue
    }
    keywordSights.push(kw)
  }

  const ordered: string[] = []
  const orderedSeen = new Set<string>()
  for (const s of [...keywordSights, ...spots]) {
    const p = sightProfile(s)
    if (p.kind !== 'sight' && p.kind !== 'generic') continue
    const key = p.phraseTerms[0] ?? foldPhotoText(s)
    if (orderedSeen.has(key) || ordered.some((o) => overlap(sightProfile(o), p))) continue
    orderedSeen.add(key)
    ordered.push(s)
  }
  const cityTerms = [...allowedCities].flatMap((k) => (PLACE_NAMES[k] ?? []).filter((n) => !/[가-힣]/.test(n))).slice(0, 12)
  if (ordered.length > 0) return { sights: ordered, reason: 'ok', cityTerms, rejectedKeywords: rejected }
  const reason: DaySightResult['reason'] = rejected.some((r) => r.why === 'other_city' || r.why === 'not_in_route')
    ? 'keyword_conflict'
    : rejected.some((r) => r.why === 'city_only')
      ? 'city_only'
      : 'no_sight'
  return { sights: [], reason, cityTerms, rejectedKeywords: rejected }
}

/** 검색어: 명소 이름 그대로 → 도시를 덧붙인 것(같은 이름 다른 곳 구분). 최대 2개. */
export function sightSearchQueries(sight: string, cityTerms: readonly string[]): string[] {
  const base = String(sight ?? '').trim().replace(/\s+/g, ' ')
  if (!base) return []
  const out = [base]
  const city = cityTerms.find((c) => !foldPhotoText(base).includes(foldPhotoText(c)))
  if (city) out.push(`${base} ${city}`)
  return out
}
