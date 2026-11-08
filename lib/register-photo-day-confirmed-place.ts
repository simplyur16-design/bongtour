/**
 * 자동 사진이 그날 장소와 같은 관문을 통과하는지.
 * 제목·설명·동선·supplierOriginal·자유일 추천 키워드는 입력으로만 읽는다. 문장을 고치거나 빈 원문을 채우지 않는다.
 * 자유일정·자유여행은 Gemini 추천 장소로 사진을 고르는 정상 경로다.
 * 출국·경유 이동은 앞으로 갈 여행지, 귀국은 마지막 체류지의 사진만 허용한다.
 * 일정 없는 크루즈·기차는 그 수단과 구간 사진을 먼저 보고, 없을 때의 예시는 수동 승인만 가능하다.
 * 방향이 글에 없으면 다른 도시를 만들지 않는다. 고르지 못한 칸의 기존 URL 은 지우지 않는다.
 * 이미 쓴 URL 은 양쪽 글에 같은 관광 장소가 있을 때만 다시 고른다.
 * 이 모듈은 사진을 검색하거나 생성하지 않는다.
 *
 * REGRESSION-FREEZE[register-photo-day-confirmed-place]: 풀·hero 는 그날 장소 관문, 다른 활동 URL 재사용 금지 — manifest
 */
import { expandPlaceValues, photoMatchGate, type MatchGateCandidate } from '@/lib/register-photo-match-gate'

/** 여행 틀·이동만 있는 낱말. 이것만 겹치면 같은 장소 재방문이 아니다. */
const FRAME_RE =
  /짐바브웨|잠비아|보츠와나|아디스아바바|아디스|상파울루|인천|부산|계림|치앙마이|파리|프랑스|스위스|이탈리아|호텔|공항|기내|조식|중식|석식|출발|도착|투숙|휴식|자유일정|자유여행|픽업|미팅|국경|셔틀/g

const SIGHT_RE = /관광|유람|사파리|폭포|폴스|공원|궁전|시장|크루즈|보트|뗏목|케이블|도보/
const HOME_PLACE_RE = /^(인천|김포|김해|부산|서울|한국)$/
const CRUISE_RE = /크루즈|유람선|페리|\bcruise\b|\bferry\b/i
const TRAIN_RE = /기차|열차|KTX|ITX|\btrain\b|\brailway\b/i
const TRANSPORT_WORD_RE = /크루즈|유람선|페리|선셋크루즈|보트|기차|열차|KTX|ITX|cruise|ferry|train|railway/gi
const NO_SIGHT_RE = /관광\s*일정\s*없음|방문\s*관광지\s*없음|관광지\s*없음|관광\s*없음|일정\s*없음/g
const UNVERIFIED_FACILITY_RE =
  /발코니|스위트|오션뷰|특실|일등|비즈니스석|퍼스트|balcony|suite|oceanview|stateroom|quantum|of the seas|royal caribbean|msc\b/gi
const CONFIRMED_REAL_CLAIM_RE = /확정|실제\s*(사진|운항|탑승|선박|열차)/
const GENERIC_ACTIVITY_RE = /^(사파리|국립공원|공원|시장|유람|관광|도보|크루즈|보트|케이블|게임드라이브|폭포|폴스)$/
const HOME_CANONICAL = new Set(['인천', '김포', '김해', '부산', '서울', '한국'])

/** 한·영·악센트 표기와 알려진 명소의 소속 도시. 표에 없는 장소는 통과시키지 않는다. */
const PLACE_EQUIV: ReadonlyArray<{ canonical: string; names: string[]; landmarks: string[] }> = [
  { canonical: '상파울루', names: ['상파울루', 'sao paulo', 'são paulo'], landmarks: [] },
  { canonical: '계림', names: ['계림', '구이린', 'guilin', 'kweilin'], landmarks: [] },
  { canonical: '치앙마이', names: ['치앙마이', 'chiang mai', 'chiangmai'], landmarks: ['도이수텝', '왓 프라탓 도이수텝', '왓프라탓도이수텝', 'doi suthep', 'wat phra that doi suthep'] },
  { canonical: '아디스아바바', names: ['아디스아바바', '아디스 아바바', 'addis ababa', 'addis'], landmarks: [] },
  { canonical: '부산', names: ['부산', 'busan'], landmarks: ['gamcheon', '감천'] },
  { canonical: '인천', names: ['인천', 'incheon'], landmarks: [] },
  { canonical: '김해', names: ['김해', 'gimhae'], landmarks: [] },
  { canonical: '서울', names: ['서울', 'seoul'], landmarks: [] },
  { canonical: '한국', names: ['한국'], landmarks: [] },
  { canonical: '파리', names: ['파리', 'paris'], landmarks: ['에펠', '에펠탑', 'eiffel', '베르사유', 'versailles'] },
  { canonical: '베네치아', names: ['베네치아', '베니스', 'venice', 'rialto'], landmarks: [] },
  { canonical: '나이로비', names: ['나이로비', 'nairobi'], landmarks: [] },
  { canonical: '후쿠오카', names: ['후쿠오카', 'fukuoka'], landmarks: [] },
  { canonical: '빅토리아폭포', names: ['빅토리아폭포', '빅토리아 폭포', '빅토리아 폴스', '빅토리아폴스', 'victoria falls'], landmarks: [] },
]

export type DayPhotoFacts = {
  title?: string | null
  description?: string | null
  routeText?: string | null
  supplierOriginalText?: string | null
  sourceMovementText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
  generationOrigin?: string | null
}

function foldPlace(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[A-Za-z\u00C0-\u024F]+/g, (word) => word.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    .toLowerCase()
}

function textHasName(text: string, name: string): boolean {
  const folded = foldPlace(text)
  const needle = foldPlace(name).replace(/\s+/g, ' ').trim()
  if (!needle) return false
  if (/[가-힣]/.test(needle)) {
    const compactNeedle = needle.replace(/\s+/g, '')
    if (compactNeedle.length >= 3 && folded.replace(/[^가-힣]/g, '').includes(compactNeedle)) return true
    for (const token of folded.split(/[^가-힣]+/)) {
      if (token === compactNeedle) return true
      if (!token.startsWith(compactNeedle)) continue
      const rest = token.slice(compactNeedle.length)
      if (/^(국제공항|공항|역|시|항)$/.test(rest)) return true
      if (compactNeedle.length >= 3) return true
    }
    return false
  }
  return ` ${folded.replace(/[^a-z0-9가-힣]+/g, ' ')} `.includes(` ${needle} `)
}

function citiesInText(text: string): string[] {
  return PLACE_EQUIV.filter((row) => row.names.some((name) => textHasName(text, name))).map((row) => row.canonical)
}

function landmarkCitiesInText(text: string): string[] {
  return PLACE_EQUIV.filter((row) => row.landmarks.some((name) => textHasName(text, name))).map((row) => row.canonical)
}

function candidatePlaceCities(candidate: MatchGateCandidate): string[] {
  const blob = [candidate.altText, candidate.pageUrl, candidate.label, candidate.originalLink].filter(Boolean).join(' ')
  return [...new Set([...citiesInText(blob), ...landmarkCitiesInText(blob)])]
}

export function dayPhotoFactsFromScheduleFields(item: {
  title?: string | null
  description?: string | null
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
  imageCandidateOrigin?: string | null
  generationOrigin?: string | null
  sourceMovementText?: string | null
  supplierOriginal?: { items?: Array<{ name?: string | null; text?: string | null }> } | null
}): DayPhotoFacts {
  const supplierOriginalText =
    item.supplierOriginal?.items
      ?.map((row) => [row.name, row.text].filter(Boolean).join(' '))
      .filter(Boolean)
      .join('\n') || null
  return {
    title: item.title,
    description: item.description,
    routeText: item.routeText,
    supplierOriginalText,
    sourceMovementText: item.sourceMovementText ?? supplierOriginalText,
    imageKeyword: item.imageKeyword,
    imageKeyword2: item.imageKeyword2,
    generationOrigin: item.generationOrigin ?? item.imageCandidateOrigin ?? null,
  }
}

export type DayPhotoContext =
  | { kind: 'recommendation' }
  | { kind: 'supplier' }
  | { kind: 'upcoming'; place: string }
  | { kind: 'last_stay'; place: string }
  | { kind: 'transport'; mode: 'cruise' | 'train'; segment: string | null }
  | { kind: 'none' }

export type TransportPhotoSourceKind = 'real' | 'example' | 'generated'

function latinPlaceTerms(dayText: string): string[] {
  return [...String(dayText).matchAll(/[A-Za-z][A-Za-z'’. -]{2,}/g)]
    .map((m) => m[0].replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 3)
}

function hasConfirmedSightMarker(text: string): boolean {
  const cleaned = text.replace(NO_SIGHT_RE, ' ')
  return SIGHT_RE.test(cleaned)
}

function placeBeforeVerb(text: string, verb: '출발' | '도착'): string | null {
  let best: { at: number; city: string } | null = null
  let from = 0
  while (from < text.length) {
    const idx = text.indexOf(verb, from)
    if (idx < 0) break
    const windowStart = Math.max(0, idx - 40)
    const window = text.slice(windowStart, idx)
    for (const row of PLACE_EQUIV) {
      for (const name of row.names) {
        if (!/[가-힣]/.test(name)) continue
        const compact = name.replace(/\s+/g, '')
        const at = window.lastIndexOf(compact)
        if (at >= 0 && (!best || windowStart + at >= best.at)) best = { at: windowStart + at, city: row.canonical }
      }
    }
    from = idx + verb.length
  }
  return best?.city ?? null
}

function isHomePlace(place: string | null): boolean {
  return place != null && HOME_PLACE_RE.test(place)
}

/** 글에 있는 출발·도착만 읽는다. 없는 도시는 만들지 않는다. */
export function travelMovePhotoPlace(text: string): { kind: 'upcoming' | 'last_stay'; place: string } | null {
  const t = String(text ?? '')
  const dep = placeBeforeVerb(t, '출발')
  const arr = placeBeforeVerb(t, '도착')
  const depHome = isHomePlace(dep)
  const arrHome = isHomePlace(arr)
  if (dep && arr) {
    if (depHome && !arrHome) return { kind: 'upcoming', place: arr }
    if (!depHome && arrHome) return { kind: 'last_stay', place: dep }
    if (!depHome && !arrHome) return { kind: 'upcoming', place: arr }
    return null
  }
  if (!dep && arr && !arrHome) return { kind: 'upcoming', place: arr }
  if (dep && !arr && !depHome && /귀국/.test(t)) return { kind: 'last_stay', place: dep }
  return null
}

function sightBesidesTransport(text: string): boolean {
  const cleaned = text.replace(NO_SIGHT_RE, ' ').replace(TRANSPORT_WORD_RE, ' ')
  return /관광|유람|사파리|폭포|폴스|공원|궁전|시장|뗏목|케이블|도보/.test(cleaned)
}

/** 관광 일정이 없고 크루즈·기차 이동만 있는 날. 구간 도시는 글에 있는 것만. */
export function transportOnlyPhotoContext(text: string): { mode: 'cruise' | 'train'; segment: string | null } | null {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!t || sightBesidesTransport(t)) return null
  const cruise = CRUISE_RE.test(t)
  const train = TRAIN_RE.test(t)
  if (cruise === train) return null
  const dep = placeBeforeVerb(t, '출발')
  const arr = placeBeforeVerb(t, '도착')
  const segment = [dep, arr].filter(Boolean).join(' ') || null
  return { mode: cruise ? 'cruise' : 'train', segment }
}

export function dayPhotoContext(text: string): DayPhotoContext {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return { kind: 'none' }
  if (/전일\s*자유\s*일정|자유일정|자유여행|추천\s*관광지|추천\s*일정/.test(t)) return { kind: 'recommendation' }
  const transport = transportOnlyPhotoContext(t)
  if (transport) return { kind: 'transport', mode: transport.mode, segment: transport.segment }
  if (hasConfirmedSightMarker(t)) return { kind: 'supplier' }
  const move = travelMovePhotoPlace(t)
  if (move) return move
  const stay = lastStayFromStored(t)
  if (stay) return { kind: 'last_stay', place: stay }
  return { kind: 'none' }
}

function lastStayFromStored(text: string): string | null {
  if (!/귀국/.test(text)) return null
  const foreign = citiesInText(text).filter((city) => !HOME_CANONICAL.has(city))
  return foreign.length === 1 ? foreign[0]! : null
}

function storedFactText(facts: DayPhotoFacts): string {
  return [facts.title, facts.description, facts.routeText]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join('\n')
}

/** 저장행·생성기록·원문 이동 구간으로 사진 문맥을 정한다. 문장은 만들지 않는다. */
export function dayPhotoContextFromFacts(facts: DayPhotoFacts): DayPhotoContext {
  const stored = storedFactText(facts)
  const source = String(facts.sourceMovementText ?? facts.supplierOriginalText ?? '').trim()
  const sourceMove = source ? travelMovePhotoPlace(source) : null
  const sourceReco = /전일\s*자유\s*일정|자유일정|자유여행|추천\s*관광지|추천\s*일정/.test(source)
  if (source && sourceMove && !hasConfirmedSightMarker(source) && !sourceReco) return sourceMove
  if (source && hasConfirmedSightMarker(source)) return dayPhotoContext(source)
  if (sourceReco || /전일\s*자유\s*일정|자유일정|자유여행|추천\s*관광지|추천\s*일정/.test(stored)) {
    return { kind: 'recommendation' }
  }
  const storedMove = travelMovePhotoPlace(stored)
  if (storedMove && !hasConfirmedSightMarker(stored)) return storedMove
  const stay = lastStayFromStored(stored)
  if (stay) return { kind: 'last_stay', place: stay }
  const generated = /gemini/i.test(String(facts.generationOrigin ?? ''))
  const named = citiesInText(`${stored}\n${facts.imageKeyword ?? ''}\n${facts.imageKeyword2 ?? ''}`).filter(
    (city) => !HOME_CANONICAL.has(city),
  )
  const marks = landmarkCitiesInText(`${stored}\n${facts.imageKeyword ?? ''}\n${facts.imageKeyword2 ?? ''}`)
  if (generated && (named.length > 0 || marks.length > 0)) return { kind: 'recommendation' }
  return dayPhotoContext(stored)
}

export function dayConfirmedPlaceText(parts: {
  title?: string | null
  description?: string | null
  routeText?: string | null
  supplierOriginalText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}): string {
  const base = [parts.supplierOriginalText, parts.title, parts.description, parts.routeText]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join('\n')
  if (dayPhotoContext(base).kind !== 'recommendation') return base
  return [base, parts.imageKeyword, parts.imageKeyword2]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join('\n')
}

/** 추천·공급사 관광·예정지·마지막 체류지·교통 구간이 있으면 사진 후보를 볼 수 있다. */
export function dayAllowsPlacePhoto(text: string): boolean {
  return dayPhotoContext(text).kind !== 'none'
}

/**
 * 출국 예정지·귀국 체류지·크루즈/기차는 재고가 없어도 여기서 생성하지 않는다.
 * 예시는 사람이 승인한 뒤에만 따로 만든다.
 */
export function blocksAutomaticDayPhotoGeneration(input: string | DayPhotoFacts): boolean {
  const kind = typeof input === 'string' ? dayPhotoContext(input).kind : dayPhotoContextFromFacts(input).kind
  return kind === 'upcoming' || kind === 'last_stay' || kind === 'transport'
}

/** 교통만 있는 날의 예시 생성 조건. 호출은 하지 않는다. */
export function transportExampleGenerationPolicy(text: string): {
  realSearchFirst: true
  whenNoRealPhoto: 'manual_example_only'
  autoInvoke: false
} | null {
  if (dayPhotoContext(text).kind !== 'transport') return null
  return { realSearchFirst: true, whenNoRealPhoto: 'manual_example_only', autoInvoke: false }
}

/** 조건부 사진의 검색어. 추천·관광·방향 불명은 null 이라 다른 도시를 넣지 않는다. */
export function photoContextSearchQuery(input: string | DayPhotoFacts): string | null {
  const ctx = typeof input === 'string' ? dayPhotoContext(input) : dayPhotoContextFromFacts(input)
  if (ctx.kind === 'upcoming' || ctx.kind === 'last_stay') return ctx.place
  if (ctx.kind === 'transport') {
    const mode = ctx.mode === 'cruise' ? '크루즈' : '기차'
    const segmentText = typeof input === 'string' ? input : String(input.sourceMovementText ?? storedFactText(input))
    const segment = ctx.segment ?? transportOnlyPhotoContext(segmentText)?.segment ?? null
    return [mode, segment].filter(Boolean).join(' ')
  }
  return null
}

function photoGateText(dayText: string): string {
  const ctx = dayPhotoContext(dayText)
  if (ctx.kind === 'upcoming' || ctx.kind === 'last_stay') return ctx.place
  if (ctx.kind === 'transport') return photoContextSearchQuery(dayText) ?? ''
  return dayText
}

/** 양쪽 원문성 글에 같은 관광 장소가 있을 때만. 나라·환승 도시 이름만 겹치면 아니다. */
export function explicitSameSightPlace(a: string, b: string): string | null {
  if (dayPhotoContext(a).kind !== 'supplier' && dayPhotoContext(a).kind !== 'recommendation') return null
  if (dayPhotoContext(b).kind !== 'supplier' && dayPhotoContext(b).kind !== 'recommendation') return null
  const left = a
  const right = b
  if (/빅토리아\s*(폭포|폴스)/.test(left) && /빅토리아\s*(폭포|폴스)/.test(right)) return '빅토리아폭포'
  if (/victoria\s*falls/i.test(left) && /victoria\s*falls/i.test(right)) return 'victoria falls'
  const tokens = (s: string) =>
    [...s.replace(FRAME_RE, ' ').matchAll(/[가-힣]{3,}/g)]
      .map((m) => m[0].replace(/(에서|으로|로|까지|부터|은|는|이|가|을|를|의|과|와|도|만)$/, ''))
      .filter((token) => !GENERIC_ACTIVITY_RE.test(token))
      .filter((token) => SIGHT_RE.test(token) || /폭포|유람|공원|사파리/.test(token))
  const rightSet = new Set(tokens(right))
  for (const token of tokens(left)) {
    if (rightSet.has(token)) return token
  }
  return null
}

export function transportPhotoSourceKind(candidate: MatchGateCandidate): TransportPhotoSourceKind | null {
  const label = [candidate.label, typeof candidate.aiLabel === 'string' ? candidate.aiLabel : ''].join(' ')
  const saysExample = /예시|\bexample\b/i.test(label)
  const saysGenerated = /생성|\bgenerated\b/i.test(label)
  if (candidate.isGenerated) {
    if (!saysExample && !saysGenerated && String(candidate.aiLabel ?? '').trim() === '') return null
    if (saysExample && !saysGenerated) return 'example'
    return 'generated'
  }
  if (saysExample) return 'example'
  if (saysGenerated) return 'generated'
  return 'real'
}

function photoBlob(candidate: MatchGateCandidate): string {
  return [candidate.altText, candidate.pageUrl, candidate.label, candidate.originalLink].filter(Boolean).join(' ')
}

function mentionsTransportMode(text: string, mode: 'cruise' | 'train'): boolean {
  return mode === 'cruise' ? CRUISE_RE.test(text) || /ship/i.test(text) : TRAIN_RE.test(text)
}

function unverifiedFacility(photoText: string, dayText: string): boolean {
  const hits = photoText.match(new RegExp(UNVERIFIED_FACILITY_RE.source, 'gi')) ?? []
  const day = dayText.toLowerCase()
  return hits.some((hit) => !day.includes(hit.toLowerCase()))
}

const TRANSPORT_GENERIC_WORD =
  /^(cruise|cruises|ship|ships|ferry|ferries|boat|boats|train|trains|railway|rail|sea|ocean|deck|water|white|large|near|port|harbor|harbour|view|views|skyline|open|blue|aerial|sunset|sunrise|daytime|scenic|landscape|waves|wave|sailing|vessel|passenger|station|platform|track|tracks|carriage|coach|photo|image|pexels|https|www|com|with|from|over|under|into|onto)$/

/** 구간 글에 없는 지명이 보이면 일반 교통 사진으로 넘기지 않는다. */
function photoNamesPlaceOutsideSegment(photoText: string, gateText: string): boolean {
  const allowed = new Set(expandPlaceValues([gateText]).map((s) => s.toLowerCase()))
  for (const tok of gateText.match(/[가-힣]{2,}/g) ?? []) allowed.add(tok)
  for (const tok of photoText.match(/[가-힣]{2,}/g) ?? []) {
    if (allowed.has(tok) || [...allowed].some((name) => name.includes(tok))) continue
    if (!/크루즈|유람선|페리|기차|열차|선박|갑판/.test(tok)) return true
  }
  for (const word of photoText.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
    if (TRANSPORT_GENERIC_WORD.test(word)) continue
    if (allowed.has(word)) continue
    return true
  }
  return false
}

export function transportCandidateAllowed(
  candidate: MatchGateCandidate,
  dayText: string,
): { ok: boolean; reason: string | null; sourceKind: TransportPhotoSourceKind | null } {
  const ctx = dayPhotoContext(dayText)
  if (ctx.kind !== 'transport') return { ok: false, reason: 'not_transport', sourceKind: null }
  const sourceKind = transportPhotoSourceKind(candidate)
  const blob = photoBlob(candidate)
  if (!sourceKind) return { ok: false, reason: 'example_unlabeled', sourceKind: null }
  if (!mentionsTransportMode(blob, ctx.mode)) return { ok: false, reason: 'transport_mismatch', sourceKind }
  if (unverifiedFacility(blob, dayText)) return { ok: false, reason: 'unverified_facility', sourceKind }
  if (sourceKind !== 'real' && CONFIRMED_REAL_CLAIM_RE.test(blob)) {
    return { ok: false, reason: 'confirmed_real_claim', sourceKind }
  }
  const gateText = photoGateText(dayText)
  const gate = photoMatchGate(
    sourceKind === 'real' ? candidate : { ...candidate, isGenerated: true, aiLabel: candidate.aiLabel ?? sourceKind },
    {
      placeTerms: [gateText, ...latinPlaceTerms(gateText)],
      destinationTerms: [],
      slotText: gateText,
      slot: 'day',
      daySummary: gateText,
    },
  )
  if (!gate.ok && gate.reason === 'no_place_match' && sourceKind === 'real' && !photoNamesPlaceOutsideSegment(blob, gateText)) {
    return { ok: true, reason: null, sourceKind }
  }
  if (!gate.ok && gate.reason === 'no_place_match' && sourceKind === 'real') {
    return { ok: false, reason: 'city_mismatch', sourceKind }
  }
  if (!gate.ok && gate.reason !== 'no_place_match') return { ok: false, reason: gate.reason, sourceKind }
  return { ok: true, reason: null, sourceKind }
}

function resolvedDay(input: string | DayPhotoFacts): { ctx: DayPhotoContext; text: string } {
  if (typeof input === 'string') return { ctx: dayPhotoContext(input), text: input }
  const ctx = dayPhotoContextFromFacts(input)
  const stored = storedFactText(input)
  const text =
    ctx.kind === 'recommendation'
      ? [stored, input.imageKeyword, input.imageKeyword2].map((part) => String(part ?? '').trim()).filter(Boolean).join('\n')
      : stored
  return { ctx, text }
}

function photoBlobOf(candidate: MatchGateCandidate): string {
  return [candidate.altText, candidate.pageUrl, candidate.label, candidate.originalLink].filter(Boolean).join(' ')
}

function mentionedLandmarkNames(text: string): string[] {
  const names: string[] = []
  for (const row of PLACE_EQUIV) {
    for (const name of row.landmarks) {
      if (textHasName(text, name)) names.push(name)
    }
  }
  return names
}

/** 출국·귀국은 체류 도시와 그 소속 명소. 관광·추천은 글에 적힌 명소만. */
function allowedLandmarkNames(ctx: DayPhotoContext, text: string): string[] {
  if (ctx.kind === 'upcoming' || ctx.kind === 'last_stay') {
    return PLACE_EQUIV.find((row) => row.canonical === ctx.place)?.landmarks ?? []
  }
  return mentionedLandmarkNames(text)
}

function mentionsDisallowedLandmark(candidate: MatchGateCandidate, allowedNames: readonly string[]): string | null {
  const blob = photoBlobOf(candidate)
  for (const row of PLACE_EQUIV) {
    for (const name of row.landmarks) {
      if (!textHasName(blob, name)) continue
      if (!allowedNames.some((allowed) => textHasName(allowed, name) || textHasName(name, allowed))) return name
    }
  }
  return null
}

function aliasGateText(base: string, candidate: MatchGateCandidate, allowedCities: readonly string[], landmarkNames: readonly string[]): string {
  const blob = photoBlobOf(candidate)
  const extra: string[] = []
  for (const city of allowedCities) {
    const row = PLACE_EQUIV.find((item) => item.canonical === city)
    if (!row) continue
    const names = [...row.names, ...row.landmarks.filter((name) => landmarkNames.some((allowed) => textHasName(allowed, name) || textHasName(name, allowed)))]
    if (names.some((name) => textHasName(blob, name))) extra.push(...names)
  }
  return [base, ...extra].filter(Boolean).join('\n')
}

export function dayPoolOrHeroAllowed(
  candidate: MatchGateCandidate,
  day: string | DayPhotoFacts,
): { ok: boolean; reason: string | null } {
  const { ctx, text } = resolvedDay(day)
  if (ctx.kind === 'none') return { ok: false, reason: 'no_confirmed_sightseeing' }
  if (ctx.kind === 'transport') {
    const transport = transportCandidateAllowed(candidate, text || (typeof day === 'string' ? day : storedFactText(day)))
    return { ok: transport.ok, reason: transport.reason }
  }
  const allowed =
    ctx.kind === 'upcoming' || ctx.kind === 'last_stay'
      ? [ctx.place]
      : [...new Set([...citiesInText(text), ...landmarkCitiesInText(text)])]
  const named = candidatePlaceCities(candidate).filter((city) => !HOME_CANONICAL.has(city) || allowed.includes(city))
  if (named.some((city) => !allowed.includes(city))) return { ok: false, reason: 'city_mismatch' }
  const landmarkNames = allowedLandmarkNames(ctx, text)
  const foreignLandmark = mentionsDisallowedLandmark(candidate, landmarkNames)
  if (foreignLandmark && (ctx.kind === 'supplier' || ctx.kind === 'recommendation')) {
    return { ok: false, reason: 'other_place_landmark' }
  }
  const gateText = aliasGateText(ctx.kind === 'upcoming' || ctx.kind === 'last_stay' ? ctx.place : text, candidate, allowed, landmarkNames)
  const gate = photoMatchGate(candidate, {
    placeTerms: [gateText, ...latinPlaceTerms(gateText)],
    destinationTerms: [],
    slotText: gateText,
    slot: 'day',
    daySummary: gateText,
  })
  return { ok: gate.ok, reason: gate.reason }
}

/** 일차 hero 해석기는 재고가 없으면 생성 API를 호출한다. 이 어댑터는 그 함수를 호출하지 않는다. */
export function routeDaySlotHero(): null {
  return null
}

export function daySelectionPersistSlice<T extends {
  day?: number
  title?: string | null
  description?: string | null
  routeText?: string | null
  supplierOriginal?: unknown
  imageUrl?: string | null
  imageUrl2?: string | null
}>(
  item: T,
  picked: { imageUrl?: string | null; imageUrl2?: string | null },
  keepExisting: boolean,
): {
  day: number | undefined
  title: string | null
  description: string | null
  routeText: string | null
  supplierOriginal: T['supplierOriginal'] | null
  imageUrl: string | null
  imageUrl2: string | null
} {
  return {
    day: item.day,
    title: item.title ?? null,
    description: item.description ?? null,
    routeText: item.routeText ?? null,
    supplierOriginal: item.supplierOriginal ?? null,
    imageUrl: keepExisting ? (item.imageUrl ?? null) : unselectedDayImageUrl(picked.imageUrl, item.imageUrl),
    imageUrl2: keepExisting ? (item.imageUrl2 ?? null) : unselectedDayImageUrl(picked.imageUrl2, item.imageUrl2),
  }
}

/**
 * 사진 문맥을 못 정한 날만 검색을 건너뛴다.
 * 제목·설명·동선·supplierOriginal 은 입력으로만 읽는다. 반환은 사진 칸을 유지할지이고, 문장을 고치지 않는다.
 */
export function keptDayImagesWhenConfirmedPlaceSkipped(item: {
  title?: string | null
  description?: string | null
  routeText?: string | null
  imageUrl?: string | null
  imageUrl2?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
  imageCandidateOrigin?: string | null
  sourceMovementText?: string | null
  supplierOriginal?: { items?: Array<{ name?: string | null; text?: string | null }> } | null
}): {
  skipped: boolean
  imageUrl: string | null
  imageUrl2: string | null
  imageKeyword: string | null
  imageKeyword2: string | null
} {
  const facts = dayPhotoFactsFromScheduleFields(item)
  if (dayPhotoContextFromFacts(facts).kind !== 'none') {
    return { skipped: false, imageUrl: null, imageUrl2: null, imageKeyword: null, imageKeyword2: null }
  }
  return {
    skipped: true,
    imageUrl: item.imageUrl ?? null,
    imageUrl2: item.imageUrl2 ?? null,
    imageKeyword: item.imageKeyword ?? null,
    imageKeyword2: item.imageKeyword2 ?? null,
  }
}

/** 새 사진을 고르지 못하면 저장 URL 을 그대로 둔다. 비우지 않는다. */
export function unselectedDayImageUrl(
  selected: string | null | undefined,
  existing: string | null | undefined,
): string | null {
  const next = String(selected ?? '').trim()
  if (next) return next
  const prev = String(existing ?? '').trim()
  return prev || null
}

/** 안 쓴 사진을 먼저. 이미 쓴 URL 은 같은 관광 장소 근거가 있을 때만. 없으면 null. 외부 호출 없음. */
export function pickDayStockCandidate<T>(
  ranked: readonly T[],
  isUsed: (item: T) => boolean,
  sameSightReuse: (item: T) => boolean,
): T | null {
  for (const item of ranked) {
    if (!isUsed(item)) return item
  }
  for (const item of ranked) {
    if (isUsed(item) && sameSightReuse(item)) return item
  }
  return null
}

export type DayPhotoPick<T> = {
  photo: T | null
  stage: 'pool' | 'hero' | 'chain' | 'kept'
  imageUrl: string | null
  imageUrl2: string | null
  title: string | null
  description: string | null
  routeText: string | null
  unresolvedReason: string | null
  generateInvoked: false
}

/**
 * pool → hero → chain → 보존. 생성 API는 호출하지 않는다.
 * 실사진이 없으면 기존 URL을 유지한다. 교통일만 수동 예시 보류 이유를 남긴다.
 */
export async function selectScheduleDayPhoto<T extends MatchGateCandidate & { url: string }>(input: {
  facts: DayPhotoFacts
  existing: {
    imageUrl?: string | null
    imageUrl2?: string | null
    title?: string | null
    description?: string | null
    routeText?: string | null
  }
  isUsed: (candidate: T) => boolean
  sameSightReuse: (candidate: T) => boolean
  loadPool: () => Promise<T | null>
  loadHero: () => Promise<T | null>
  loadChain: () => Promise<T | null>
}): Promise<DayPhotoPick<T>> {
  const text = {
    title: input.existing.title ?? null,
    description: input.existing.description ?? null,
    routeText: input.existing.routeText ?? null,
    imageUrl2: input.existing.imageUrl2 ?? null,
  }
  const keep = (unresolvedReason: string): DayPhotoPick<T> => ({
    photo: null,
    stage: 'kept',
    imageUrl: input.existing.imageUrl ?? null,
    unresolvedReason,
    generateInvoked: false,
    ...text,
  })
  const ctx = dayPhotoContextFromFacts(input.facts)
  if (ctx.kind === 'none') return keep('no_confirmed_sightseeing')
  const accept = (candidate: T | null): candidate is T => {
    if (!candidate?.url) return false
    if (input.isUsed(candidate) && !input.sameSightReuse(candidate)) return false
    return dayPoolOrHeroAllowed(candidate, input.facts).ok
  }
  const pool = await input.loadPool()
  if (accept(pool)) {
    return { photo: pool, stage: 'pool', imageUrl: pool.url, unresolvedReason: null, generateInvoked: false, ...text }
  }
  const hero = await input.loadHero()
  if (accept(hero)) {
    return { photo: hero, stage: 'hero', imageUrl: hero.url, unresolvedReason: null, generateInvoked: false, ...text }
  }
  const chain = await input.loadChain()
  if (accept(chain)) {
    return { photo: chain, stage: 'chain', imageUrl: chain.url, unresolvedReason: null, generateInvoked: false, ...text }
  }
  if (ctx.kind === 'transport') return keep('manual_example_only')
  return keep('no_verified_real_photo')
}
