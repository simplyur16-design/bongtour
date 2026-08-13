/**
 * 해외 패키지 일정요약(description) SSOT.
 * 1) 공급사 일차 문장(품질 통과 시)
 * 2) 없으면 route 명소로 2~3문장 (명소명 필수, route에 없는 지명 금지)
 * 자유여행(FIT)은 이 모듈을 쓰지 않는다.
 * REGRESSION-FREEZE[register-schedule-description-characteristic-ssot]: 공급사 문장 우선, 없으면 route 명소 2~3문장 — manifest
 */
import { registerScheduleDescriptionHasMarketingNoise } from '@/lib/register-schedule-description-marketing-guard'

export const REGISTER_SCHEDULE_DESCRIPTION_MAX = 720

export type ScheduleDescFacet =
  | 'arrival'
  | 'return'
  | 'theme_park'
  | 'city_walk'
  | 'heritage'
  | 'viewpoint'
  | 'harbor_coast'
  | 'island'
  | 'nature'
  | 'onsen'
  | 'resort'
  | 'steppe'
  | 'alpine'
  | 'generic'

const HUB_PLACE_RE =
  /^(?:인천|김포|부산|청주|대구|ICN|GMP|PUS|TAE|CJJ|귀국|출국)(?:\s|$)|공항$/i

const FAMOUS_POI_RE =
  /디즈니랜드|디즈니\s*랜드|피크트램|빅토리아\s*피크|헐리우드\s*로드|웡타이신|타이쿤|소호거리|소호\s*거리|미드레벨|에스컬레이터|천문산|원가계|자금성|만리장성|타지마할|콜로세움|에펠|루브르|후지산|후지\s*산|규슈|유후인|벳푸|온천·강변/i

const GENERIC_VIBE_RE =
  /하루 동안 여러 장면이 자연스럽게|특정 장소보다 전체적인|명소 나열보다 분위기와 리듬/

const FACET_CLOSER: Record<ScheduleDescFacet, string> = {
  arrival: '첫날 리듬을 맞추며 일정을 이어갑니다.',
  return: '별도의 관광보다 이동 중심으로 여행을 마무리합니다.',
  theme_park: '테마파크 구역을 오가며 하루를 이어갑니다.',
  city_walk: '거리를 걸으며 하루 일정을 이어갑니다.',
  heritage: '유적 구간을 천천히 둘러보며 하루를 마무리합니다.',
  viewpoint: '전망이 열리는 구간에서 하루를 마무리합니다.',
  harbor_coast: '항구와 수변 감각으로 하루를 이어갑니다.',
  island: '섬 일정을 이어서 진행합니다.',
  nature: '풍경과 시야가 열리는 구간으로 하루를 이어갑니다.',
  onsen: '온천 마을 리듬으로 하루를 마무리합니다.',
  resort: '휴양 리듬으로 하루를 이어갑니다.',
  steppe: '초원과 협곡의 스케일로 하루를 이어갑니다.',
  alpine: '산과 호수 풍경으로 하루를 이어갑니다.',
  generic: '동선에 맞춰 하루 일정을 이어갑니다.',
}

function jongseong(ch: string): number | null {
  const code = ch.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return null
  return (code - 0xac00) % 28
}

function eulReul(word: string): string {
  const last = word.slice(-1)
  const j = jongseong(last)
  if (j === null) return `${word}를`
  return j === 0 ? `${word}를` : `${word}을`
}

function waGwa(a: string, b: string): string {
  const j = jongseong(a.slice(-1))
  if (j === null || j === 0) return `${a}와 ${b}`
  return `${a}과 ${b}`
}

function euroRo(word: string): string {
  const j = jongseong(word.slice(-1))
  if (j === null) return `${word}로`
  if (j === 0 || j === 8) return `${word}로`
  return `${word}으로`
}

function eseo(word: string): string {
  return `${word}에서`
}

function stripPlaceParens(label: string): string {
  return String(label ?? '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isHubPlace(label: string): boolean {
  const t = stripPlaceParens(label)
  if (!t) return true
  return HUB_PLACE_RE.test(t)
}

function placeChunks(label: string): string[] {
  const bare = stripPlaceParens(label)
  if (!bare) return []
  const chunks = bare
    .split(/[,，·/]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  return [...new Set([bare, ...chunks])]
}

export function countRegisterScheduleDescriptionSentences(desc: string): number {
  const t = String(desc ?? '').trim()
  if (!t) return 0
  const parts = t
    .split(/(?<=(?:습니다|입니다|됩니다|겁니다|니다|세요|다|요|까)\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
  if (parts.length >= 2) return parts.length
  return t
    .split(/[.!?。]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8).length
}

export function splitRegisterScheduleDescriptionSentences(desc: string): string[] {
  const t = String(desc ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return []
  const parts = t
    .split(/(?<=(?:습니다|입니다|됩니다|겁니다|니다|세요|다|요|까)\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length >= 2) return parts
  return t
    .split(/(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
}

export function inferScheduleDescFacets(day: number, maxDay: number, blob: string): ScheduleDescFacet[] {
  const t = String(blob ?? '')
  const facets: ScheduleDescFacet[] = []
  const isLast = maxDay >= 2 && day === maxDay
  const isFirst = day === 1

  if (
    isLast &&
    /인천|김포|GMP|\bICN\b|귀국|출국|귀국길/i.test(t) &&
    !/디즈니|테마파크|사원|피크|소호|박물관|온천|협곡/i.test(t)
  ) {
    facets.push('return')
  }
  if (/디즈니|Disney|유니버설|Universal\s*Studios|테마파크|에버랜드/i.test(t)) {
    facets.push('theme_park')
  }
  if (/피크|Peak|산정|전망대|트램|케이블카|노르트케테|융프라우/i.test(t) && !facets.includes('theme_park')) {
    facets.push('viewpoint')
  }
  if (
    /소호|골목|거리|로드|워킹|도보|센트럴|미드|상점가|번화가|구시가지|광장/i.test(t) &&
    !facets.includes('theme_park')
  ) {
    facets.push('city_walk')
  }
  if (/사원|신사|궁|성당|사찰|왕궁|유적|요새|성곽|신전|박물관/i.test(t) && !facets.includes('theme_park')) {
    facets.push('heritage')
  }
  if (/온천|유후인|벳푸|하코네|기노사키|죠잔케이|쿠사츠/i.test(t)) {
    facets.push('onsen')
  }
  if (/란타우|섬\b|Island|보홀|세부|푸꾸옥|몰디브|Maldives|오아후|하와이/i.test(t)) {
    facets.push('island')
  }
  if (/항구|해안|하버|Harbor|해변|비치|선착장|부두|걸프|아드리아/i.test(t)) {
    facets.push('harbor_coast')
  }
  if (/국립공원|협곡|기암|초원|사막|피오르드|빙하|폭포|호수|록키|사파리/i.test(t)) {
    facets.push('nature')
  }
  if (/알프스|설봉|산자락|융프라우|체르마트|인터라켄|할슈타트/i.test(t)) {
    facets.push('alpine')
  }
  if (/몰디브|Maldives|리조트|비치\s*빌라|풀사이드|자유\s*일정|휴양/i.test(t)) {
    facets.push('resort')
  }
  if (/초원|스텝|게르|차른|알마티|오르도스|몽골/i.test(t)) {
    facets.push('steppe')
  }
  if (isFirst && !facets.includes('theme_park') && /인천|김포|ICN|출발|입국|공항/i.test(t)) {
    facets.unshift('arrival')
  }
  if (facets.length === 0) {
    if (isLast) facets.push('return')
    else if (isFirst) facets.push('arrival')
    else facets.push('generic')
  }
  const uniq: ScheduleDescFacet[] = []
  for (const f of facets) {
    if (!uniq.includes(f)) uniq.push(f)
  }
  return uniq.slice(0, 3)
}

export function registerScheduleDescriptionMentionsRoutePoi(
  desc: string,
  routePlaces: readonly string[],
): boolean {
  const t = String(desc ?? '')
  if (!t) return false
  for (const p of routePlaces) {
    if (isHubPlace(p)) continue
    for (const chunk of placeChunks(p)) {
      if (chunk.length >= 2 && t.includes(chunk)) return true
    }
  }
  return false
}

/** route에 없는 유명 지명이 본문에 있으면 true (환각) */
export function registerScheduleDescriptionHasAttractionNameLeak(
  desc: string,
  routePlaces: readonly string[] = [],
): boolean {
  const t = String(desc ?? '')
  if (!t) return false
  const hay = routePlaces.map((p) => stripPlaceParens(p)).join(' ')
  const matches = t.match(FAMOUS_POI_RE)
  if (!matches) return false
  for (const m of matches) {
    const token = String(m).replace(/\s+/g, '')
    const hayCompact = hay.replace(/\s+/g, '')
    if (token.length >= 2 && !hayCompact.includes(token) && !hay.includes(String(m))) {
      return true
    }
  }
  return false
}

function capAtSentenceBoundary(desc: string, max = REGISTER_SCHEDULE_DESCRIPTION_MAX): string {
  const t = desc.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const parts = splitRegisterScheduleDescriptionSentences(t)
  let acc = ''
  for (const p of parts) {
    const next = acc ? `${acc} ${p}` : p
    if (next.length > max) break
    acc = next
  }
  return (acc || t.slice(0, max)).trim()
}

function takeSentences(desc: string, n: number): string {
  return splitRegisterScheduleDescriptionSentences(desc).slice(0, n).join(' ').trim()
}

function pickRoutePois(routePlaces: readonly string[], max = 4): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of routePlaces) {
    const p = stripPlaceParens(raw)
    if (!p || isHubPlace(p)) continue
    const k = p.replace(/\s/g, '')
    if (seen.has(k)) continue
    seen.add(k)
    out.push(p)
    if (out.length >= max) break
  }
  return out
}

/**
 * 공급사 일차 문장 — 2~3문장, 마케팅·리뷰·vibe 템플릿·환각 지명 없으면 채택.
 * REGRESSION-FREEZE[register-schedule-description-characteristic-ssot]
 */
export function acceptSupplierScheduleDaySummary(
  supplierText: string | null | undefined,
  routePlaces: readonly string[],
  day: number,
  maxDay: number,
): string | null {
  let t = String(supplierText ?? '').replace(/\s+/g, ' ').trim()
  if (!t || t.length < 20) return null
  if (GENERIC_VIBE_RE.test(t)) return null
  if (registerScheduleDescriptionHasMarketingNoise(t)) return null
  if (/리뷰|여행후기|평균별점|상품평점|tripadvisor/i.test(t)) return null
  if (registerScheduleDescriptionHasAttractionNameLeak(t, routePlaces)) return null

  let n = countRegisterScheduleDescriptionSentences(t)
  if (n > 3) t = takeSentences(t, 3)
  n = countRegisterScheduleDescriptionSentences(t)
  const isHubDay =
    (day === 1 || (maxDay >= 2 && day === maxDay)) &&
    (pickRoutePois(routePlaces).length === 0 || /귀국|출발|입국|인천|김포/i.test(t))
  if (!isHubDay && !registerScheduleDescriptionMentionsRoutePoi(t, routePlaces)) return null
  if (n < 2) return null
  if (n > 3) return null
  return capAtSentenceBoundary(t)
}

function synthesizeFromRoute(opts: {
  day: number
  maxDay: number
  routePlaces: readonly string[]
  joinedBlob: string
}): string {
  const day = Math.max(1, Math.floor(Number(opts.day) || 1))
  const maxDay = Math.max(day, Math.floor(Number(opts.maxDay) || day))
  const blob = String(opts.joinedBlob ?? '').trim() || opts.routePlaces.filter(Boolean).join(' - ')
  const facets = inferScheduleDescFacets(day, maxDay, blob)
  const pois = pickRoutePois(opts.routePlaces)
  const isLast = maxDay >= 2 && day === maxDay
  const isFirst = day === 1
  const closer = FACET_CLOSER[facets[0] ?? 'generic']
  const sentences: string[] = []

  if (isLast && facets[0] === 'return' && pois.length <= 1) {
    sentences.push('체크아웃 후 인천으로 귀국합니다.')
    sentences.push(FACET_CLOSER.return)
    return sentences.join(' ')
  }

  if (isFirst && (facets.includes('arrival') || /인천|김포|출발|입국/i.test(blob))) {
    const dest = pois[0] || '현지'
    sentences.push(`인천에서 출발해 ${eseo(dest)} 도착합니다.`)
    const rest = pois.slice(1)
    if (rest.length >= 2) {
      sentences.push(`${eulReul(waGwa(rest[0]!, rest[1]!))} 둘러봅니다.`)
    } else if (rest.length === 1) {
      sentences.push(`${eulReul(rest[0]!)} 둘러보며 첫날 일정을 이어갑니다.`)
    } else {
      sentences.push(`${eseo(dest)} 첫날 일정을 이어갑니다.`)
    }
    if (sentences.length < 3) sentences.push(FACET_CLOSER.arrival)
    return sentences.slice(0, 3).join(' ')
  }

  if (facets.includes('theme_park')) {
    const park = pois.find((p) => /디즈니|유니버설|테마파크|에버랜드/i.test(p)) || pois[pois.length - 1] || '테마파크'
    const island = pois.find((p) => /란타우|섬/i.test(p) && p !== park)
    if (island) sentences.push(`${euroRo(island)} 이동합니다.`)
    sentences.push(`${eseo(park)} 종일 일정을 보냅니다.`)
    if (sentences.length < 2) sentences.push(FACET_CLOSER.theme_park)
    if (sentences.length < 3) sentences.push(closer)
    return sentences.slice(0, 3).join(' ')
  }

  if (pois.length >= 3) {
    sentences.push(`${eulReul(waGwa(pois[0]!, pois[1]!))} 둘러봅니다.`)
    if (pois[3]) {
      sentences.push(`${eulReul(waGwa(pois[2]!, pois[3]!))} 이어서 방문합니다.`)
    } else {
      sentences.push(`${eulReul(pois[2]!)} 이어서 방문합니다.`)
    }
    sentences.push(closer)
    return sentences.slice(0, 3).join(' ')
  }

  if (pois.length === 2) {
    sentences.push(`${eulReul(waGwa(pois[0]!, pois[1]!))} 중심으로 하루를 보냅니다.`)
    sentences.push(closer)
    if (sentences.length < 3) sentences.push('동선에 맞춰 일정을 이어갑니다.')
    return sentences.slice(0, 3).join(' ')
  }

  if (pois.length === 1) {
    sentences.push(`${eulReul(pois[0]!)} 중심으로 하루 일정을 진행합니다.`)
    sentences.push(closer)
    return sentences.join(' ')
  }

  sentences.push(`${day}일차 일정을 진행합니다.`)
  sentences.push(closer)
  return sentences.join(' ')
}

/**
 * 일정요약 SSOT — 공급사 문장 우선, 없으면 route 명소 2~3문장.
 * REGRESSION-FREEZE[register-schedule-description-characteristic-ssot]
 */
export function composeRegisterScheduleDaySummary(opts: {
  day: number
  maxDay: number
  routePlaces: readonly string[]
  joinedBlob: string
  regionSentences?: readonly string[] | null
  supplierText?: string | null
}): string {
  const accepted = acceptSupplierScheduleDaySummary(
    opts.supplierText,
    opts.routePlaces,
    opts.day,
    opts.maxDay,
  )
  if (accepted) return accepted
  return capAtSentenceBoundary(
    synthesizeFromRoute({
      day: opts.day,
      maxDay: opts.maxDay,
      routePlaces: opts.routePlaces,
      joinedBlob: opts.joinedBlob,
    }),
  )
}

/** @deprecated 이름 호환 — composeRegisterScheduleDaySummary 와 동일 */
export function composeRegisterScheduleCharacteristicDescription(opts: {
  day: number
  maxDay: number
  routePlaces: readonly string[]
  joinedBlob: string
  regionSentences?: readonly string[] | null
  supplierText?: string | null
}): string {
  return composeRegisterScheduleDaySummary(opts)
}
