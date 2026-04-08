/**
 * 참좋은여행(verygoodtour) 전용: 일차 `description`을 하루 흐름 요약으로 정리한다.
 * 한 문장 고득점 조기 종료 없이, 이동·관광·마무리(공항/출국/도착/휴식) 의미 단위를 2~4개 조합한다.
 *
 * 톤 가드: 과장·연속 감탄만 최소 완화. 단어 단위 전역 삭제 금지(§9.3 금지어를 일정 문장에서 잘라내면 조건·구분·약관 의미가 깨짐).
 */
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'

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
    return { ...row, description: desc }
  })
}
