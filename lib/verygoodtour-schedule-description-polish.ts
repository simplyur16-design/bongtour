/**
 * 참좋은여행(verygoodtour) 전용: 일차 `description`을 하루 흐름 요약으로 정리한다.
 * 일차 `title`은 미리보기 1줄 헤더용으로 **방문지 A-B-C** 형식(하이픈 연결)만 정규화한다.
 *
 * 톤 가드: 과장·연속 감탄만 최소 완화. 단어 단위 전역 삭제 금지(§9.3 금지어를 일정 문장에서 잘라내면 조건·구분·약관 의미가 깨짐).
 */
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'

const DAY_N_TRAVEL_RE = /^day\s*\d+\s*travel$/i

const VERYGOOD_TITLE_JUNK = /1\/2이전다음|이전다음|상세보기|일정표_|데이투어|요금\s*:|소요시간\s*:|대체일정\s*:|\[TIP\]|※/gi

const MEAL_HOTEL_IN_TITLE = /호텔|리조트|조식|중식|석식|예정\s*호텔|면세점|쇼핑\s*센터/i

/** title 스캔용 지명(긴 이름 우선) */
const VERYGOOD_TITLE_PLACES: string[] = `체스키크룸로프 잘츠부르크 브로츠와프 부다페스트 할슈타트 인터라켄 취리히 제네바 루체른 베네치아 피렌체 로마 밀라노 바티칸 파리 니스 마르세유 런던 에든버러 바르셀로나 마드리드 리스본 베를린 뮌헨 비엔나 프라하 크라쿠프 융프라우 인터라켄 그린델발트 인천 김포 서울 부산 제주 도쿄 요코하마 오사카 교토 삿포로 나고야 후쿠오카 가나자와 홍콩 마카오 타이페이 방콕 치앙마이 파타야 푸켓 다낭 하노이 호치민 발리 싱가포르 시드니 멜버른 뉴욕 밴쿠버 토론토 괌 사이판 호놀룰루 상해 북경 광저우 연길 장춘`
  .split(/\s+/)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length)

function stripVerygoodTitleScanText(text: string): string {
  return text.replace(VERYGOOD_TITLE_JUNK, ' ').replace(/\s+/g, ' ').trim()
}

function squashHyphenChain(t: string): string {
  return t
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*·\s*/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractVerygoodTitlePlaces(hay: string): string[] {
  const h = hay.replace(/\s+/g, ' ')
  if (!h) return []
  const hits: Array<{ idx: number; name: string }> = []
  for (let i = 0; i < h.length; i++) {
    for (const name of VERYGOOD_TITLE_PLACES) {
      if (h.startsWith(name, i)) {
        hits.push({ idx: i, name })
        i += name.length - 1
        break
      }
    }
  }
  hits.sort((a, b) => a.idx - b.idx)
  const seen = new Set<string>()
  const out: string[] = []
  for (const { name } of hits) {
    if (seen.has(name)) continue
    if (MEAL_HOTEL_IN_TITLE.test(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

function isReturnDayHay(hay: string, isLastDay: boolean): boolean {
  if (!isLastDay) return false
  return /(?:귀국|출국|공항\s*이동|국제선).{0,80}(?:도착|입국|인천)|(?:인천|ICN).{0,40}(?:도착|입국)/u.test(hay)
}

function isMovementHay(hay: string): boolean {
  const hasMove = /(?:출발|도착|이동|입국|공항|미팅|환승|편으로)/u.test(hay)
  const hasSight = /(?:관광|방문|입장|체험|명소|둘러보)/u.test(hay)
  return hasMove && !hasSight
}

function formatVerygoodOneLineVisitTitle(
  title: string,
  descriptionRaw: string,
  ctx: { isLastDay: boolean }
): string {
  const hay = stripVerygoodTitleScanText(`${title}\n${descriptionRaw}`)
  const places = extractVerygoodTitlePlaces(hay)
  const maxLen = 56

  if (isReturnDayHay(hay, ctx.isLastDay)) {
    const body = places.filter((p) => p !== '인천' && p !== '김포')
    if (body.length) return squashHyphenChain(`${body.slice(0, 3).join('-')}-인천`).slice(0, maxLen)
    if (/인천/u.test(hay) && /(?:도착|귀국|입국)/u.test(hay)) return '인천'
  }

  if (isMovementHay(hay) && places.length >= 2) {
    const a = places[0]!
    const b = places[1]!
    return squashHyphenChain(`${a}-${b}`).slice(0, maxLen)
  }

  if (places.length >= 2) {
    return squashHyphenChain(places.slice(0, 4).join('-')).slice(0, maxLen)
  }

  if (places.length === 1) return places[0]!.slice(0, maxLen)

  const t0 = stripVerygoodTitleScanText(title)
  if (
    t0 &&
    t0.length >= 2 &&
    t0.length <= maxLen &&
    !DAY_N_TRAVEL_RE.test(t0) &&
    !/^Day\s*\d+$/i.test(t0) &&
    !/^\d{4}[./-]\d{1,2}[./-]\d{1,2}/.test(t0) &&
    !MEAL_HOTEL_IN_TITLE.test(t0) &&
    !/(?:습니다|합니다|입니다)\s*\.?\s*$/u.test(t0)
  ) {
    return squashHyphenChain(t0).slice(0, maxLen)
  }

  const descHay = stripVerygoodTitleScanText(descriptionRaw)
  const dp = extractVerygoodTitlePlaces(descHay)
  if (dp.length >= 2) return squashHyphenChain(dp.slice(0, 4).join('-')).slice(0, maxLen)
  if (dp.length === 1) return dp[0]!.slice(0, maxLen)
  return ''
}

/** 공백·연속 느낌표 정리만. 원문 명사·조건·절차 문구는 삭제하지 않음. */
function applyVerygoodScheduleDescriptionToneGuard(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim()
  if (!t) return t
  t = t.replace(/!{2,}/g, '!')
  return t
}

function finalizeVerygoodScheduleDescription(text: string): string {
  return applyVerygoodScheduleDescriptionToneGuard(text)
}

type MeaningSlot = 'flow' | 'sight' | 'closure'

/** 의미 슬롯(상호 배타): 마무리 > 관광 > 이동 순으로 분류 */
function classifyMeaningSlot(s: string): MeaningSlot | null {
  const t = s.trim()
  if (!t) return null
  if (
    /휴식|투숙|숙박|공항|터미널|OZ\d|KE\d|편으로|편으로|귀국|입국|인천국제|인천|김포|도착|해산|짐\s*수령|이후\s*공항|국제선|국내선|탑승\s*수속/.test(t)
  )
    return 'closure'
  if (
    /관광|방문|전경|감상|박물관|궁전|사원|파크|피어|시내|명소|세븐|랜드마크|자유\s*일정|자유\s*시간|쇼핑|체험|입장/.test(t)
  )
    return 'sight'
  if (/이동|출발|향해|경유|에서\s*출발|으로\s*이동|로\s*이동|편성/.test(t)) return 'flow'
  return null
}

type LegacyKind = 'movement' | 'sightseeing' | 'airport' | 'free'

const MOVEMENT_RE =
  /이동|출발|도착|향해|경유|에서\s*출발|으로\s*이동|로\s*이동|편성|열차|버스|크루즈|페리|비행|탑승|환승|셔틀|드라이브|Drive/i
const SIGHT_RE =
  /관광|방문|전경|감상|명소|투어|둘러|시내|박물관|궁전|사원|파크|피어|랜드마크|랜드\s*마크|기념물|유적|입장|체험|쇼핑|자유\s*관광/i
const AIRPORT_RE =
  /공항|터미널|출국|입국|귀국|인천|김포|GMP|ICN|항공편|국제선|국내선|OZ\d|KE\d|편\s*으로|편으로|탑승\s*수속/i
const FREE_RE = /자유\s*일정|자유\s*시간|자유\s*활동|Free\s*time|자유일정/i

function kindsInSentence(s: string): Set<LegacyKind> {
  const o = new Set<LegacyKind>()
  if (MOVEMENT_RE.test(s)) o.add('movement')
  if (SIGHT_RE.test(s)) o.add('sightseeing')
  if (AIRPORT_RE.test(s)) o.add('airport')
  if (FREE_RE.test(s)) o.add('free')
  return o
}

function kindsInText(t: string): Set<LegacyKind> {
  const u = new Set<LegacyKind>()
  for (const k of kindsInSentence(t)) u.add(k)
  return u
}

function splitIntoSentenceUnits(t: string): string[] {
  const normalized = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const parts = normalized.split(/(?<=[。．!?])\s+|(?<=[.!?])\s+|\n+/).map((x) => x.trim())
  const out: string[] = []
  for (const p of parts) {
    if (!p) continue
    if (p.includes('·')) {
      for (const x of p.split(/\s*·\s*/)) {
        const z = x.trim()
        if (z && !/^[-–—•]+$/.test(z)) out.push(z)
      }
    } else {
      out.push(p)
    }
  }
  return out
}

function coverageKinds(units: string[]): Set<LegacyKind> {
  const u = new Set<LegacyKind>()
  for (const s of units) {
    for (const k of kindsInSentence(s)) u.add(k)
  }
  return u
}

function isLikelySinglePlaceToken(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/[\n。．.!?]/.test(t)) return false
  if (/\s/.test(t)) return false
  if (/[·\/]/.test(t)) return false
  return /^[가-힣A-Za-z0-9]+$/.test(t)
}

function llmDescriptionIsAdequateScheduleSummary(text: string): boolean {
  const t = stripVerygoodScheduleUiNoiseLines(text).trim()
  if (!t) return false
  const units = splitIntoSentenceUnits(t)
  if (units.length === 0) return false
  const slots = new Set(units.map(classifyMeaningSlot).filter((x): x is MeaningSlot => x != null))
  if (slots.size >= 2) return true
  if (units.length >= 2 && slots.size >= 1) return true
  if (units.length === 1) {
    const one = units[0]!
    if (isLikelySinglePlaceToken(one)) return false
    return classifyMeaningSlot(one) != null || kindsInSentence(one).size >= 1
  }
  return false
}

function llmDescriptionIsStructurallyThin(text: string): boolean {
  const t = stripVerygoodScheduleUiNoiseLines(text).trim()
  if (!t) return true
  if (isLikelySinglePlaceToken(t) && kindsInText(t).size === 0) return true
  const units = splitIntoSentenceUnits(t)
  if (units.length <= 1 && kindsInText(t).size === 0) return true
  return false
}

function looksLikePastedBlockStructure(text: string): boolean {
  const t = text.replace(/\r\n/g, '\n')
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean)
  const uiHits = lines.filter((l) => /지도보기|내용보기|내용\s*전체\s*열기/.test(l)).length
  if (uiHits >= 2) return true
  if (lines.length < 6) return false
  const withEnder = lines.filter((l) => /[。．.!?]$/.test(l.trim())).length
  return withEnder / lines.length < 0.2
}

function stripVerygoodScheduleUiNoiseLines(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (/^지도보기(\s*지도보기)*$/i.test(t)) continue
    if (t === '내용 전체 열기' || t === '내용보기') continue
    if (/^내용\s*전체\s*열기$/i.test(t)) continue
    if (/^지도보기\s*$/i.test(t)) continue
    if (/^내용보기\s*$/i.test(t)) continue
    if (/^[-–—•]\s*$/.test(t)) continue
    out.push(t)
  }
  return out.join('\n')
}

function isLikelyHotelOrMealOnlyLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (/^호텔\s*$|^식사\s*$|^▶\s*호텔|^▶\s*식사/.test(t)) return true
  if (/^☆\s*호텔|^★\s*호텔|^예정\s*호텔|^예정숙소|^숙소\s*[:：]/.test(t)) return true
  if (/^(조식|중식|석식|아침|점심|저녁)\s*[:：]/.test(t)) return true
  if (/^[★☆]{2,}/.test(t) && /호텔|Hotel|HOTEL|리조트|콘도/i.test(t)) return true
  return false
}

type UnitMeta = { u: string; i: number; slot: MeaningSlot | null }

function collectUnitMetas(text: string): UnitMeta[] {
  const t = stripVerygoodScheduleUiNoiseLines(text)
  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean).filter((l) => !isLikelyHotelOrMealOnlyLine(l))
  const joined = lines.join(' ').replace(/\s+/g, ' ').trim()
  if (!joined) return []
  const units = splitIntoSentenceUnits(joined).filter((s) => !isLikelyHotelOrMealOnlyLine(s))
  return units.map((u, i) => ({ u: u.trim(), i, slot: classifyMeaningSlot(u) }))
}

/**
 * 하루 일정: 이동·관광·마무리 슬롯별로 최대 개수를 두고, 문서 순서를 유지해 2~4개 의미 단위를 고른다.
 */
function selectDiverseMeaningUnits(metas: UnitMeta[], opts: { isLastDay: boolean }): string[] {
  const maxTotal = opts.isLastDay ? 5 : 4
  const limits = opts.isLastDay
    ? { flow: 1, sight: 1, closure: 3 }
    : { flow: 2, sight: 2, closure: 2 }

  let nf = 0
  let ns = 0
  let nc = 0
  const picked: UnitMeta[] = []

  for (const m of metas) {
    if (!m.u) continue
    if (!m.slot) continue
    if (m.slot === 'flow' && nf >= limits.flow) continue
    if (m.slot === 'sight' && ns >= limits.sight) continue
    if (m.slot === 'closure' && nc >= limits.closure) continue
    picked.push(m)
    if (m.slot === 'flow') nf++
    if (m.slot === 'sight') ns++
    if (m.slot === 'closure') nc++
    if (picked.length >= maxTotal) break
  }

  if (picked.length < 2) {
    for (const m of metas) {
      if (picked.some((p) => p.u === m.u)) continue
      if (!m.u.trim()) continue
      picked.push(m)
      if (picked.length >= 2) break
    }
  }

  picked.sort((a, b) => a.i - b.i)
  let ordered = picked.map((p) => p.u)

  if (opts.isLastDay && ordered.length > 1) {
    const air = ordered.filter((s) => AIRPORT_RE.test(s) || /도착|입국|귀국|터미널|인천/.test(s))
    const rest = ordered.filter((s) => !air.includes(s))
    ordered = [...air, ...rest]
  }

  return ordered
}

function buildSummaryFromDeterministicRaw(raw: string, opts: { isLastDay: boolean }): string {
  const metas = collectUnitMetas(raw).filter((m) => !/^[-–—•]+$/.test(m.u.trim()))
  if (metas.length === 0) return ''
  const sel = selectDiverseMeaningUnits(metas, opts)
  if (sel.length === 0) return metas.map((m) => m.u).join(' ').replace(/\s+/g, ' ').trim()
  return sel.join(' ').replace(/\s+/g, ' ').trim()
}

function polishDescriptionFromMergedText(text: string, opts: { isLastDay: boolean }): string {
  const metas = collectUnitMetas(text).filter((m) => !/^[-–—•]+$/.test(m.u.trim()))
  if (metas.length === 0) return stripVerygoodScheduleUiNoiseLines(text).replace(/\s+/g, ' ').trim()
  const sel = selectDiverseMeaningUnits(metas, opts)
  if (sel.length === 0) return metas.map((m) => m.u).join(' ').replace(/\s+/g, ' ').trim()
  return sel.join(' ').replace(/\s+/g, ' ').trim()
}

function uniquePoolStrings(a: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of a) {
    const t = s.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** 결정론 문장 순서를 먼저 두고, LLM 문장을 중복 제외해 뒤에 붙인 뒤 슬롯별로 고른다 */
function mergeLlmPoolWithDeterministic(llmText: string, detText: string, opts: { isLastDay: boolean }): string {
  const llmMetas = collectUnitMetas(llmText)
  const detMetas = collectUnitMetas(detText)
  const pool: UnitMeta[] = []
  let o = 0
  const seen = new Set<string>()
  for (const m of detMetas) {
    if (seen.has(m.u)) continue
    seen.add(m.u)
    pool.push({ ...m, i: o++ })
  }
  for (const m of llmMetas) {
    if (seen.has(m.u)) continue
    seen.add(m.u)
    pool.push({ ...m, i: o++ })
  }
  return selectDiverseMeaningUnits(pool, opts).join(' ').replace(/\s+/g, ' ').trim()
}

export function narrativeCompactVerygoodDayDescription(raw: string, opts?: { isLastDay?: boolean }): string {
  const isLastDay = Boolean(opts?.isLastDay)
  const stripped = stripVerygoodScheduleUiNoiseLines(raw).trim()
  if (!stripped) return ''

  if (looksLikePastedBlockStructure(raw) || looksLikePastedBlockStructure(stripped)) {
    return finalizeVerygoodScheduleDescription(buildSummaryFromDeterministicRaw(stripped, { isLastDay }))
  }

  return finalizeVerygoodScheduleDescription(polishDescriptionFromMergedText(stripped, { isLastDay }))
}

export function pickMergedVerygoodDayDescription(
  g: RegisterScheduleDay,
  d: RegisterScheduleDay | undefined,
  opts?: { isLastDay?: boolean }
): string {
  const isLastDay = Boolean(opts?.isLastDay)
  const gsRaw = (g.description ?? '').trim()
  const dsRaw = (d?.description ?? '').trim()
  const gs = stripVerygoodScheduleUiNoiseLines(gsRaw).trim()

  if (!d || !dsRaw) {
    if (!gs) return ''
    if (looksLikePastedBlockStructure(gsRaw)) return narrativeCompactVerygoodDayDescription(gsRaw, { isLastDay })
    return finalizeVerygoodScheduleDescription(polishDescriptionFromMergedText(gs, { isLastDay }))
  }

  const ds = stripVerygoodScheduleUiNoiseLines(dsRaw).trim()

  if (!gs) return finalizeVerygoodScheduleDescription(buildSummaryFromDeterministicRaw(ds, { isLastDay }))

  if (looksLikePastedBlockStructure(gsRaw)) {
    const compactG = buildSummaryFromDeterministicRaw(gs, { isLastDay })
    const gMetas = collectUnitMetas(compactG)
    const slotSet = new Set(gMetas.map((m) => m.slot).filter((x): x is MeaningSlot => x != null))
    if (slotSet.size >= 2) return finalizeVerygoodScheduleDescription(compactG)
    return finalizeVerygoodScheduleDescription(buildSummaryFromDeterministicRaw(ds, { isLastDay }))
  }

  if (llmDescriptionIsStructurallyThin(gsRaw)) {
    if (isLikelySinglePlaceToken(gs))
      return finalizeVerygoodScheduleDescription(buildSummaryFromDeterministicRaw(ds, { isLastDay }))
    const merged = uniquePoolStrings([...splitIntoSentenceUnits(gs), ...splitIntoSentenceUnits(ds)]).join(' ')
    return finalizeVerygoodScheduleDescription(polishDescriptionFromMergedText(merged, { isLastDay }))
  }

  if (llmDescriptionIsAdequateScheduleSummary(gsRaw)) {
    const merged = mergeLlmPoolWithDeterministic(gs, ds, { isLastDay })
    if (merged.trim()) return finalizeVerygoodScheduleDescription(merged)
  }

  return finalizeVerygoodScheduleDescription(mergeLlmPoolWithDeterministic(gs, ds, { isLastDay }))
}

export function polishVerygoodRegisterScheduleDescriptions(schedule: RegisterScheduleDay[]): RegisterScheduleDay[] {
  if (!schedule?.length) return schedule
  const maxDay = Math.max(...schedule.map((s) => Number(s.day) || 0))
  return schedule.map((row) => {
    const day = Number(row.day) || 0
    const isLastDay = maxDay >= 1 && day === maxDay
    const raw = row.description ?? ''
    const desc = narrativeCompactVerygoodDayDescription(raw, { isLastDay })
    const titleNext = formatVerygoodOneLineVisitTitle(String(row.title ?? ''), raw, { isLastDay })
    return { ...row, title: titleNext || String(row.title ?? '').trim(), description: desc }
  })
}
