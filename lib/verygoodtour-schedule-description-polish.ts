/**
 * 참좋은여행(verygoodtour) 전용: 일차 `description`을 하루 흐름 요약으로 정리한다.
 * 일차 `title`은 미리보기 1줄 헤더용으로 **방문지 A-B-C** 형식(하이픈 연결)만 정규화한다.
 * 일차 `description`은 카드용 **일정 요약**으로 **3~5문장**(상한만 두고, 원문이 짧으면 그보다 짧을 수 있음)을 목표로 한다.
 *
 * 서술형 레이어: `composeNarrativeVerygoodDayDescription` 등으로 관광→자유→이동→숙박 호흡을 잡되,
 * 원문 밖 정보는 넣지 않는다. `coercePolishLastDayFlag`·run-on 분리·저녁/호텔 병합 등 기존 안정화는 유지.
 *
 * 톤 가드: 과장·연속 감탄만 최소 완화. 단어 단위 전역 삭제 금지(§9.3 금지어를 일정 문장에서 잘라내면 조건·구분·약관 의미가 깨짐).
 */
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'

/** `finalizeVerygoodScheduleDescription`: 요약 문장·글자 상한 (3~5문장 분량에 맞춤) */
const VERYGOOD_DESCRIPTION_MAX_SENTENCES = 5
const VERYGOOD_DESCRIPTION_MAX_CHARS = 800

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

/** 일차 상단 `도시-도시` 루트 라인(참좋은 상세) */
function stripMarkdownHeadingLine(line: string): string {
  return line.replace(/^#{1,6}\s+/u, '').trim()
}

function tryVerygoodHyphenRouteTitle(lineRaw: string): string | null {
  const t = squashHyphenChain(stripMarkdownHeadingLine(lineRaw.trim()))
  if (!t || MEAL_HOTEL_IN_TITLE.test(t)) return null
  if (/^\d{1,2}일차$/u.test(t) || DAY_N_TRAVEL_RE.test(t) || /^Day\s*\d+$/i.test(t)) return null
  const parts = t
    .split(/[-–—]/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 2 && p.length <= 34)
  if (parts.length < 2) return null
  if (parts.some((p) => /^\d+$/.test(p) || /일차$/u.test(p))) return null
  return squashHyphenChain(parts.slice(0, 4).join('-'))
}

function isHangulSyllable(ch: string | undefined): boolean {
  if (!ch) return false
  return /[\uAC00-\uD7A3]/.test(ch)
}

/**
 * 본문 설명·역사 서술 속 지명은 title 후보에서 제외(또는 강하게 감점)한다.
 * `로마 교황`, `…양식의`, `…에 위치한` 등.
 */
function isVerygoodTitlePlaceProseContext(hay: string, idx: number, name: string): boolean {
  const nameLen = name.length
  const after = hay.slice(idx + nameLen, idx + nameLen + 40)
  const before = hay.slice(Math.max(0, idx - 24), idx)
  const window = hay.slice(Math.max(0, idx - 18), Math.min(hay.length, idx + nameLen + 36))

  if (/^\s*교황/u.test(after)) return true
  if (/^\s*교황청/u.test(after)) return true
  if (/^\s*대교구/u.test(after)) return true
  if (/^\s*총대주교/u.test(after)) return true
  if (/^\s*설명/u.test(after)) return true
  if (/^\s*양식의/u.test(after)) return true
  if (/^\s*양식으로/u.test(after)) return true
  if (/^\s*으로\s*알려/u.test(after)) return true
  if (/^\s*로\s*알려/u.test(after)) return true
  if (/^\s*으로\s*불리/u.test(after)) return true
  if (/^\s*로\s*불리/u.test(after)) return true
  if (/^\s*에서\s*유래/u.test(after)) return true
  if (/^\s*에\s*위치/u.test(after)) return true
  if (/^\s*을\s*기리/u.test(after)) return true
  if (/^\s*를\s*기리/u.test(after)) return true
  if (/성인\s*$/u.test(before.trim()) && /^\s*의/u.test(after)) return true

  if (
    /(?:역사|전설|신화|배경|소개|설명)\s*$/u.test(before) &&
    /^\s*(?:으로|로|의|은|는|이|가|,)/u.test(after)
  )
    return true

  if (nameLen <= 2 && isHangulSyllable(idx > 0 ? hay[idx - 1] : undefined) && isHangulSyllable(hay[idx + nameLen])) {
    return true
  }

  if (idx > 560) {
    const w120 = hay.slice(Math.max(0, idx - 100), Math.min(hay.length, idx + nameLen + 60))
    if (
      !/(?:####|호텔\s*조식|조식\s*후|출발|이동|도착|관광|입장|도보|유람|투어|일차|편으로)/u.test(
        w120
      )
    ) {
      return true
    }
  }

  void window
  return false
}

function verygoodTitlePlacePriorityTier(idx: number): number {
  if (idx < 100) return 0
  if (idx < 320) return 1
  if (idx < 620) return 2
  return 3
}

type TitlePlaceHit = { idx: number; name: string }

function extractVerygoodTitlePlaceHits(hay: string): TitlePlaceHit[] {
  const h = hay.replace(/\s+/g, ' ')
  if (!h) return []
  const hits: TitlePlaceHit[] = []
  for (let i = 0; i < h.length; i++) {
    for (const name of VERYGOOD_TITLE_PLACES) {
      if (h.startsWith(name, i)) {
        hits.push({ idx: i, name })
        i += name.length - 1
        break
      }
    }
  }
  return hits
}

function extractVerygoodTitlePlacesFromHay(hay: string): string[] {
  const raw = extractVerygoodTitlePlaceHits(hay)
  const filtered = raw.filter((hit) => !isVerygoodTitlePlaceProseContext(hay, hit.idx, hit.name))
  let pool = filtered.length > 0 ? filtered : raw.filter((hit) => hit.idx < 480)
  if (pool.length === 0) pool = raw.slice(0, 12)
  pool = [...pool].sort((a, b) => {
    const ta = verygoodTitlePlacePriorityTier(a.idx)
    const tb = verygoodTitlePlacePriorityTier(b.idx)
    if (ta !== tb) return ta - tb
    return a.idx - b.idx
  })
  const seen = new Set<string>()
  const out: string[] = []
  for (const { name } of pool) {
    if (seen.has(name)) continue
    if (MEAL_HOTEL_IN_TITLE.test(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

function squashHyphenChain(t: string): string {
  return t
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*·\s*/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
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
  const maxLen = 56
  const routeFromTitle = tryVerygoodHyphenRouteTitle(title)
  if (routeFromTitle) return routeFromTitle.slice(0, maxLen)
  const descLines = descriptionRaw.split(/\r?\n/).map((l) => l.trim())
  for (const line of descLines.filter((l) => l.length > 0).slice(0, 10)) {
    if (/^#{1,6}\s/u.test(line)) continue
    const r = tryVerygoodHyphenRouteTitle(line)
    if (r) return r.slice(0, maxLen)
  }

  const hay = stripVerygoodTitleScanText(`${title}\n${descriptionRaw}`)
  const places = extractVerygoodTitlePlacesFromHay(hay)

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
  const dp = extractVerygoodTitlePlacesFromHay(descHay)
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

/** 외부에서 단일 일차에 `isLastDay: true`만 넘긴 경우(붙여넣기 병합 등) 귀국일 슬롯을 적용하지 않는다. */
function coercePolishLastDayFlag(isLastDay: boolean, ...hayParts: string[]): boolean {
  if (!isLastDay) return false
  const h = hayParts.join('\n').replace(/\s+/g, ' ')
  if (/(?:귀국|입국|공항\s*으로|공항으로|국제선|국내선|인천국제|ICN|GMP)/u.test(h)) return true
  if (/(?:OZ|KE|LJ|TW|BX)\s*\d{2,4}/i.test(h)) return true
  return false
}

/**
 * LLM·본문 병합 후에도 남는 일정표 복붙 노이즈 제거 (ItineraryDay 요약용).
 * 선택관광·이동시간 괄호·항공편·반복 연결어·숙박 푸터·현지 안내문 등.
 */
function stripVerygoodItineraryDescriptionPasteNoise(text: string): string {
  let t = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  t = t.replace(/●\s*선택\s+관광\s*●[^\n●]{0,180}/gi, ' ')
  t = t.replace(/●\s*선택관광\s*●\s*[^●\n]*?[_＿]\s*\d{1,4}\s*유로/gi, ' ')
  t = t.replace(/[_＿]\s*\d{1,4}\s*유로/gi, '')
  t = t.replace(/\(\s*약\s*\d{1,2}\s*(?:시간|분)[^)]*소요\s*\)/g, '')
  t = t.replace(/\(약\s*\d{1,2}\s*(?:시간|분)[^)]*소요\)/g, '')
  t = t.replace(/\(약[^)]*소요\)/g, '')
  t = t.replace(/※\s*현지\s*상황에\s*따른[^\n。.]{0,120}/g, '')
  t = t.replace(/※\s*현지\s*상황에\s*따라[^\n。.]{0,120}/g, '')
  t = t.replace(/호텔\s*투숙\s*및\s*휴식[^\n。.]{0,120}/g, '')
  t = t.replace(/※[^※\n]*유람선[^※\n]*※[^\n]*/g, '')
  t = t.replace(/※\s*유람선[^※]{0,260}/g, '')
  t = t.replace(/※\s*중식[^\n。.]{0,160}/g, '')
  t = t.replace(/※\s*중간항공[^\n。.]{0,220}/g, '')
  t = t.replace(/※\s*현지사정[^\n。.]{0,160}/g, '')
  t = t.replace(/※\s*오슬로\s*가이드[^\n。.]{0,240}/g, '')
  t = t.replace(/※\s*내부\s*행사[^\n。.]{0,200}/g, '')
  t = t.replace(/※\s*노르웨이\s*일정은[^\n。.]{0,260}/g, '')
  t = t.replace(/※현지\s*도로상황[^\n。.]{0,220}/g, '')
  t = t.replace(/●\s*[^●\n]{2,140}?(?:\d{1,3}\s*유로\s*)?옵션\s*포함\s*●/gi, ' ')
  t = t.replace(/\d{1,2}:\d{2}\s*편(?=\s+[가-힣])/g, '')
  t = t.replace(/\b(?:OZ|KE|LJ|TW|BX|SK)\s*\d{3,4}\b/gi, '')
  t = t.replace(/\d{1,2}:\d{2}\s*(?=(?:OZ|KE|LJ|TW|BX|SK)\s*\d)/gi, '')
  t = t.replace(/([가-힣]{2,12})\s+\d{1,2}:\d{2}\s+\1(?=\s|,|$|[.])/gu, '$1')
  t = t.replace(/출발\s*-\s*[가-힣]{2,12}\s*향발/gu, ' ')
  t = t.replace(/출발\s*\d+\s*주\s*전[^\n。.]*/g, '')
  t = t.replace(/변경\s*유무\s*확인[^\n。.]*/g, '')
  for (let k = 0; k < 12; k++) {
    t = t.replace(/(?:이후\s*,\s*){2,}/g, '이후 ')
    t = t.replace(/(?:이동해\s*,\s*){2,}/g, '이동하여 ')
    t = t.replace(/이동해\s*,\s*이동해\s*,/g, '이동하여 ')
    t = t.replace(/이동하여\s+이동해/g, '이동하여')
    t = t.replace(/둘러본\s*뒤\s*둘러본\s*뒤/g, '둘러본 뒤')
    t = t.replace(/관광\s*후\s*둘러본\s*뒤\s*둘러본\s*뒤/g, '관광 후 ')
    t = t.replace(/도착\s*후\s*도착\s*후/g, '도착 후 ')
  }
  t = t.replace(/(?:이후\s*){2,}/g, '이후 ')
  t = t.replace(/\s*,\s*이후\s*,\s*이후/gu, ' 이후')
  t = t.replace(/[,\s]*이후\s*[,.]\s*$/g, '')
  for (let k = 0; k < 4; k++) {
    t = t.replace(/\s+-\s+[A-Z][a-z]{2,26}\b/g, '')
  }
  t = t.replace(/^([가-힣]+)\s+호텔\s*조식\s*후\s*/u, '')
  t = t.replace(/^선상\s*조식\s*후\s*/u, '')
  t = t.replace(/([가-힣]{2,12})\s*(시내에서)\s*,\s*\1(?=\s|$|[,.])/gu, '$1 $2')
  t = t.replace(/([가-힣]{2,14})\s*시내,\s*\1\s*,\s*도착/gu, '$1 시내, 도착')
  t = t.replace(/\bRailway\b/gi, '')
  t = t.replace(/\s*'\s*[^']{1,40}\s*'\s+OR\s+'[^']{1,40}'/gi, '')
  t = t.replace(/■+/g, '')
  t = t.replace(/자유\s*시간\s+,/gu, '자유시간 ')
  t = t.replace(/,\s*$/g, '')
  t = t.replace(/\n+/g, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  t = collapseVerygoodDuplicateSummaryRun(t)
  return t.replace(/\s+/g, ' ').trim()
}

/** 같은 문단이 `., ` 등으로 두 번 붙은 붙여넣기 제거(길이·반복 상한으로만). */
function collapseVerygoodDuplicateSummaryRun(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim()
  for (let k = 0; k < 8; k++) {
    const n = t.replace(/([\s\S]{55,500}?)(?:\.\s*,\s*|\s*,\s*)\1(?:$|[.。]|,)/u, '$1')
    if (n === t) break
    t = n
  }
  for (let k = 0; k < 6; k++) {
    const n = t.replace(/(.{55,360})\1/u, '$1')
    if (n === t) break
    t = n
  }
  return t
}

function hardCapVerygoodDescriptionLength(text: string, max = VERYGOOD_DESCRIPTION_MAX_CHARS): string {
  const s = text.replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const idx = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('.'), cut.lastIndexOf(','), cut.lastIndexOf(' '))
  if (idx > Math.floor(max * 0.45)) return `${cut.slice(0, idx).trim()}…`
  return `${cut.trim()}…`
}

function finalizeVerygoodScheduleDescription(text: string): string {
  const stripped = stripVerygoodItineraryDescriptionPasteNoise(text)
  const toned = applyVerygoodScheduleDescriptionToneGuard(stripped)
  const capped = capDescriptionToMaxSentences(toned, VERYGOOD_DESCRIPTION_MAX_SENTENCES)
  return hardCapVerygoodDescriptionLength(capped, VERYGOOD_DESCRIPTION_MAX_CHARS)
}

/** 마침표·개행이 거의 없는 붙여넣기 나열을 이정표 키워드 앞에서 잘게 나눈다(과분할 방지: 경계 앞 최소 글자 수). */
function splitKoreanItineraryRunOnsOnce(s: string): string[] {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return []
  if (t.length < 6) return [t]

  type Rule = { re: RegExp; minBefore: number }
  const rules: Rule[] = [
    { re: /\s+(?=자유\s*시간|자유\s*일정|자유\s*활동)/gi, minBefore: 8 },
    { re: /\s+(?=(?:오전|오후|저녁)\s)/gu, minBefore: 18 },
    { re: /\s+(?=(?:으로|로|에서)\s+이동)/g, minBefore: 10 },
    {
      // "휴게소 경유"는 한 덩어리로 두고, 그 밖에서만 `경유` 앞에서 끊는다.
      re: /(?<!휴게소)\s+(?=경유\s)/gu,
      minBefore: 12,
    },
    {
      // "오후 도착 후 …"에서 `오후`와 `도착` 사이는 끊지 않음(앞쪽만 '오후'로 남아 슬롯 null이 됨).
      re: /(?<!오후)(?<!오전)(?<!저녁)\s+(?=도착\s)/gu,
      minBefore: 12,
    },
    {
      // "이동 후 출발 …" 등은 한 흐름으로 둔다(앞만 남으면 요약이 `…이동 후`로 끊김).
      re: /(?<!\s후)(?<![가-힣]후)\s+(?=출발\s|탑승\s|환승\s)/gu,
      minBefore: 12,
    },
    {
      // "저녁 호텔 투숙"은 한 덩어리로 유지(앞에서 `저녁`만 잘리면 strip 길이로 전부 탈락함).
      re: /(?<!저녁)(?<!호텔)\s+(?=호텔\s*(?:투숙|숙박)|예정\s*호텔|투숙\s*및|투숙|숙박)(?=\s|[가-힣])/gu,
      minBefore: 10,
    },
    {
      // "투숙 및 휴식"은 한 마무리로 유지(과분할 시 closure 슬롯이 중복되어 일부가 탈락함).
      re: /(?<!및)\s+(?=휴식)(?=\s|[가-힣])/gu,
      minBefore: 12,
    },
    { re: /\s+(?=귀국|입국)(?=\s|[가-힣])/gu, minBefore: 8 },
  ]

  const breaks = new Set<number>()
  for (const { re, minBefore } of rules) {
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
    let m: RegExpExecArray | null
    while ((m = r.exec(t)) !== null) {
      const pos = m.index
      if (t.slice(0, pos).trim().length >= minBefore) breaks.add(pos)
    }
  }
  const sorted = [...breaks].sort((a, b) => a - b)
  const parts: string[] = []
  let start = 0
  for (const b of sorted) {
    if (b <= start) continue
    const chunk = t.slice(start, b).trim()
    if (chunk) parts.push(chunk)
    start = b
  }
  const tail = t.slice(start).trim()
  if (tail) parts.push(tail)
  return parts.length ? parts : [t]
}

function splitKoreanItineraryRunOns(s: string, depth = 0): string[] {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return []
  if (depth > 14) return [t]
  const parts = splitKoreanItineraryRunOnsOnce(t)
  if (parts.length === 1) return parts
  return parts.flatMap((p) => splitKoreanItineraryRunOns(p, depth + 1))
}

/** splitIntoSentenceUnits 전에 나열형 한 줄을 쪼갠다. */
function expandRunOnsBeforeSentenceSplit(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    const chunks = splitKoreanItineraryRunOns(t)
    for (const c of chunks) out.push(c)
  }
  return out.length ? out : [text.replace(/\s+/g, ' ').trim()]
}

/** 이미 glue·마침표가 들어간 요약문은 run-on 재분할 없이 끊는다(과분할로 앞 문장만 남는 현상 방지). */
function splitForSentenceCapOnly(t: string): string[] {
  const normalized = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalized) return []
  const out: string[] = []
  for (const line of normalized.split('\n')) {
    const L = line.trim()
    if (!L) continue
    const parts = L.split(/(?<=[。．!?])\s+|(?<=[.!?])\s+/).map((x) => x.trim())
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
  }
  return out.length ? out : [normalized.replace(/\s+/g, ' ').trim()]
}

/** 카드용 일정 소개: 의미 단위 병합 후에도 최대 문장 수로 제한 */
function capDescriptionToMaxSentences(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return t
  const units = splitForSentenceCapOnly(t)
  if (units.length <= max) return t
  return units
    .slice(0, max)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type MeaningSlot = 'sight' | 'free' | 'flow' | 'closure'

/** 의미 슬롯: 자유시간·관광·이동·항공/숙박 마무리 구분(한 줄에 여러 의미가 있으면 강한 키워드 우선). */
function classifyMeaningSlot(s: string): MeaningSlot | null {
  const t = s.trim()
  if (!t) return null
  if (/자유\s*시간|자유\s*일정|자유\s*활동|Free\s*time/i.test(t)) {
    const tail = t.replace(/^[\s\S]*?(?:자유\s*시간|자유\s*일정|자유\s*활동|Free\s*time)/i, '').trim()
    if (!tail || tail.length < 2) return 'free'
    if (!/(?:저녁|투숙|숙박|휴식|공항|귀국|입국|이동)/u.test(tail)) return 'free'
  }
  if (/^도착\s*후\s*시내|^오후\s*도착\s*후/u.test(t.trim())) return 'flow'
  if (/^저녁\s+호텔/u.test(t)) return 'closure'
  if (/^저녁\s*$/u.test(t)) return 'closure'
  if (
    t.length >= 28 &&
    /(?:거리|골목|시장|어시장|광장|성당|교회|박물관|미술관|궁전|유람|피오르드|빙하|전망대|국립공원|조망|둘러보)/u.test(t) &&
    !/^도착\s*후\s*시내/u.test(t.trim())
  ) {
    return 'sight'
  }
  const hasSightWord =
    /관광|방문|전경|감상|박물관|궁전|사원|파크|피어|시내|명소|세븐|랜드마크|조망|관람|입장|체험|둘러보|유람|산책/i.test(t)
  const hasStrongSight =
    /관광|방문|전경|감상|박물관|궁전|사원|파크|피어|명소|세븐|랜드마크|조망|관람|입장|체험|둘러보|유람|산책/i.test(t)
  const hasClosureOnly =
    /(?:^|[^가-힣])(?:OZ|KE|LJ|TW|BX|SK)\s*\d{2,4}\b|편으로|편\s*으로|탑승\s*수속|수하물|미팅\s*장소|집결|소요\s*시간|출발\s*전\s*안내|공항|터미널|귀국|입국|인천국제|국제선|국내선|투숙|숙박|휴식|해산|짐\s*수령/.test(
      t
    )
  if (hasSightWord) {
    if (!hasStrongSight && /\b시내\b/u.test(t) && /(?:도착|출발|경유|이동|투숙|공항)/u.test(t)) return 'flow'
    return 'sight'
  }
  if (hasClosureOnly && !hasSightWord) {
    if (/휴식|투숙|숙박/.test(t) && !/공항|터미널|OZ|KE|편으로|귀국|입국|탑승\s*수속/.test(t)) return 'closure'
    return 'closure'
  }
  if (/휴식|투숙|숙박|공항|터미널|OZ\d|KE\d|편으로|귀국|입국|인천국제|인천|김포|해산|짐\s*수령|이후\s*공항|국제선|국내선|탑승\s*수속/.test(t))
    return 'closure'
  if (/도착|출발/.test(t) && /공항|터미널|인천|김포|ICN|GMP|항공|국제선|편으로|OZ|KE|SK/.test(t)) return 'closure'
  if (
    /관광|방문|전경|감상|박물관|궁전|사원|파크|피어|시내|명소|세븐|랜드마크|쇼핑/.test(t)
  )
    return 'sight'
  if (/이동|출발|향해|경유|에서\s*출발|으로\s*이동|로\s*이동|편성/.test(t)) return 'flow'
  if (/(?:호텔|숙소)\s*로\s*복귀|호텔(?:로)?\s*복귀|숙소(?:로)?\s*복귀/u.test(t)) return 'closure'
  if (/,\s*이후\s*$/.test(t) || /^이후\s*[,.]?\s*$/u.test(t)) return 'flow'
  return null
}

function slotOutputPriority(slot: MeaningSlot): number {
  if (slot === 'sight') return 0
  if (slot === 'free') return 1
  if (slot === 'flow') return 2
  return 3
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

function splitIntoSentenceUnits(t: string): string[] {
  const normalized = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const runOnPieces = expandRunOnsBeforeSentenceSplit(normalized)
  const out: string[] = []
  for (const piece of runOnPieces) {
    const parts = piece.split(/(?<=[。．!?])\s+|(?<=[.!?])\s+/).map((x) => x.trim())
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

function looksLikePastedBlockStructure(text: string): boolean {
  const t = text.replace(/\r\n/g, '\n')
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean)
  const uiHits = lines.filter((l) => /지도보기|내용보기|내용\s*전체\s*열기/.test(l)).length
  if (uiHits >= 2) return true
  if (lines.length < 6) {
    if (lines.length >= 1 && lines.length <= 3) {
      const flat = lines.join(' ')
      const punct = flat.match(/[。．.!?]/g)?.length ?? 0
      if (flat.length >= 72 && punct <= 1) return true
    }
    return false
  }
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

/** description 본문에서 항공편 번호·운영 안내 등 카드 요약에 불필요한 덩어리만 가볍게 제거(원문 의미 단위는 유지). */
function stripVerygoodClauseOperationalNoise(u: string): string | null {
  let t = u.replace(/\s+/g, ' ').trim()
  if (!t) return null
  if (/^(?:미팅|집결|수하물|소요\s*시간|출발\s*전|탑승\s*전)\b/i.test(t)) return null
  if (/^식사\s*[:：]/i.test(t) && t.length < 48) return null
  t = t
    .replace(/(?:OZ|KE|LJ|TW|BX|SK)\s*\d{2,4}\s*편?/gi, ' ')
    .replace(/(?:미팅\s*장소|집결\s*장소|수하물\s*안내|출발\s*전\s*안내)\s*[:：]?\s*[^\n.]{0,56}/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length < 2) return null
  return t
}

function isAirportClosureClause(u: string, slot: MeaningSlot | null): boolean {
  return (
    slot === 'closure' &&
    /(?:OZ|KE|LJ|TW|BX|SK|편으로|편\s*으로|공항|터미널|인천|김포|ICN|GMP|항공|국제선|귀국|입국|탑승)/i.test(u)
  )
}

function pickVerygoodClauseGlue(prev: string, next: string, isLastDay: boolean): string {
  if (/^후\s+/u.test(next)) return ' '
  if (/^저녁/u.test(next) && /(?:자유\s*시간|자유\s*일정)\s*$/u.test(prev.replace(/\s+/g, ' ').trim())) return '. '
  if (/자유\s*시간|자유\s*일정|자유\s*활동/i.test(next)) {
    if (/시내\s*$/u.test(prev)) return ', '
    return ' 뒤 '
  }
  if (/(?:으로|로|에서)\s*이동|\b이동\b/.test(next)) {
    if (/\s*후\s*$/u.test(prev)) return ' '
    return ' 이후 '
  }
  if (/^출발|^도착|^경유|^탑승|^환승/.test(next)) return ' 이후 '
  if (/투숙|숙박|휴식/.test(next) && !/관광|방문|명소/.test(next)) return ', '
  if (isLastDay && /인천|공항|귀국|입국|도착|탑승|터미널|ICN|GMP/i.test(next)) return ' '
  void prev
  return '. '
}

/** 나열형 절을 읽기 쉬운 한 줄로 이을 때 접속(원문에 없는 지명·수치는 추가하지 않음). */
function joinVerygoodDescriptionClauses(parts: string[], opts: { isLastDay: boolean }): string {
  const a = parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (a.length === 0) return ''
  if (a.length === 1) return a[0]!
  const out: string[] = []
  for (let i = 0; i < a.length; i++) {
    const cur = a[i]!
    if (i === 0) {
      out.push(cur)
      continue
    }
    const prev = a[i - 1]!
    out.push(pickVerygoodClauseGlue(prev, cur, opts.isLastDay), cur)
  }
  return out.join('').replace(/\s+/g, ' ').trim()
}

type UnitMeta = { u: string; i: number; slot: MeaningSlot | null }

/**
 * `…시내 자유시간 저녁 호텔 투숙`처럼 한 덩어리로 남으면 `자유` 분기가 먼저 걸려 슬롯이 왜곡됨 → 꼬리만 안전하게 분리.
 */
function splitCompoundFreeTailClauses(u: string): string[] {
  const t0 = u.replace(/\s+/g, ' ').trim()
  const t = t0.replace(/(자유\s*시간)저녁/gu, '$1 저녁')
  const m1 = t.match(/^(.{0,520}?자유\s*시간)\s*(저녁.+)$/u)
  if (m1) return [m1[1]!.trim(), m1[2]!.trim()].filter(Boolean)
  const m2 = t.match(/^(.{0,520}?자유\s*시간)\s+((?:호텔|숙소)\s*(?:투숙|숙박).+)$/u)
  if (m2) return [m2[1]!.trim(), m2[2]!.trim()].filter(Boolean)
  return [t]
}

function mergeVerygoodEveningHotelFragments(metas: UnitMeta[]): UnitMeta[] {
  const out: UnitMeta[] = []
  for (let i = 0; i < metas.length; i++) {
    const cur = metas[i]!
    const nx = metas[i + 1]
    const ct = cur.u.trim()
    if (/^저녁\s*$/u.test(ct) && nx && /^(?:호텔|숙소|투숙|숙박|휴식)/u.test(nx.u.trim())) {
      const merged = `${cur.u} ${nx.u}`.replace(/\s+/g, ' ').trim()
      const slot = classifyMeaningSlot(merged) ?? nx.slot
      out.push({ u: merged, i: cur.i, slot })
      i++
      continue
    }
    out.push(cur)
  }
  return out
}

/** `…자유시간` + `저녁` + `호텔 투숙` 삼단 분리 시 마지막 일정이 슬롯 밖으로 밀리는 경우 */
function mergeFreeEveningHotelTriplet(metas: UnitMeta[]): UnitMeta[] {
  const out: UnitMeta[] = []
  for (let i = 0; i < metas.length; i++) {
    const a = metas[i]!
    const b = metas[i + 1]
    const c = metas[i + 2]
    const at = a.u.replace(/\s+/g, ' ').trim()
    if (/(?:자유\s*시간|자유\s*일정)$/u.test(at) && b && /^저녁\s*$/u.test(b.u.trim()) && c && /^(?:호텔|숙소|투숙)/u.test(c.u.trim())) {
      const right = `${b.u} ${c.u}`.replace(/\s+/g, ' ').trim()
      out.push({ u: a.u, i: a.i, slot: classifyMeaningSlot(a.u) ?? 'free' })
      out.push({ u: right, i: b.i, slot: classifyMeaningSlot(right) ?? 'closure' })
      i += 2
      continue
    }
    out.push(a)
  }
  return out
}

function collectUnitMetas(text: string): UnitMeta[] {
  const t = stripVerygoodScheduleUiNoiseLines(text)
  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean).filter((l) => !isLikelyHotelOrMealOnlyLine(l))
  const joined = stripVerygoodItineraryDescriptionPasteNoise(lines.join(' ').replace(/\s+/g, ' ').trim())
  if (!joined) return []
  const units = splitIntoSentenceUnits(joined)
    .flatMap((u) => splitCompoundFreeTailClauses(u))
    .filter((s) => !isLikelyHotelOrMealOnlyLine(s))
  const out: UnitMeta[] = []
  let seq = 0
  for (const u of units) {
    const cleaned = stripVerygoodClauseOperationalNoise(u)
    if (!cleaned) continue
    out.push({ u: cleaned, i: seq++, slot: classifyMeaningSlot(cleaned) })
  }
  return mergeFreeEveningHotelTriplet(mergeVerygoodEveningHotelFragments(out))
}

/**
 * 하루 일정: 관광·자유·이동·마무리 슬롯별 상한을 두고 고른 뒤,
 * 출력 순서는 관광 실체 우선(이동·항공이 관광 앞에 오지 않게)으로 재정렬한다.
 */
function selectDiverseMeaningUnitMetas(metas: UnitMeta[], opts: { isLastDay: boolean }): UnitMeta[] {
  const maxTotal = opts.isLastDay ? 6 : 5
  const limits = opts.isLastDay
    ? { sight: 2, free: 1, flow: 1, closure: 4 }
    : { sight: 2, free: 1, flow: 3, closure: 1 }

  let nf = 0
  let ns = 0
  let nfr = 0
  let nc = 0
  const picked: UnitMeta[] = []

  for (const m of metas) {
    if (!m.u) continue
    if (!m.slot) continue
    if (m.slot === 'flow' && nf >= limits.flow) continue
    if (m.slot === 'sight' && ns >= limits.sight) continue
    if (m.slot === 'free' && nfr >= limits.free) continue
    if (m.slot === 'closure' && nc >= limits.closure) continue
    picked.push(m)
    if (m.slot === 'flow') nf++
    if (m.slot === 'sight') ns++
    if (m.slot === 'free') nfr++
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

  picked.sort((a, b) => {
    if (opts.isLastDay) {
      const aa = isAirportClosureClause(a.u, a.slot) ? 1 : 0
      const bb = isAirportClosureClause(b.u, b.slot) ? 1 : 0
      if (aa !== bb) return aa - bb
    }
    const pa = a.slot != null ? slotOutputPriority(a.slot) : 9
    const pb = b.slot != null ? slotOutputPriority(b.slot) : 9
    if (pa !== pb) return pa - pb
    return a.i - b.i
  })

  return picked
}

/** 관광 실체가 있을 때 이동·도착 절이 관광 앞에 남아 있으면 관광 뒤로 미룬다(원문 절만 재배치). */
function mergeMeaningUnitsIntoNarrativeFlow(metas: UnitMeta[], opts: { isLastDay: boolean }): UnitMeta[] {
  if (opts.isLastDay) return metas
  const hasSight = metas.some((m) => m.slot === 'sight')
  if (!hasSight) return metas
  const headFlow = (u: string) => /^(?:도착|출발|이동|공항|터미널)\b/u.test(u.trim())
  const sight = metas.filter((m) => m.slot === 'sight')
  const nonSight = metas.filter((m) => m.slot !== 'sight')
  const badHead = nonSight.filter((m) => m.slot === 'flow' && headFlow(m.u))
  const okNonSight = nonSight.filter((m) => !(m.slot === 'flow' && headFlow(m.u)))
  if (badHead.length === 0) return metas
  return [...sight, ...okNonSight, ...badHead]
}

/** 나열형 한 절을 서술형으로 다듬되 원문 조각 밖 표현은 넣지 않는다. */
function normalizeVerygoodNarrativeClause(u: string, slot: MeaningSlot | null): string {
  let t = (stripVerygoodClauseOperationalNoise(u) ?? '')
    .replace(/^#{1,6}\s*[^\n]+\s*/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return ''
  t = t
    .replace(/(?:일정\s*예정|현지\s*사정에\s*따라\s*변경)[^\n.]{0,48}/gu, ' ')
    .replace(/출발\s*전까지\s*홈페이지를\s*통해\s*알려드리겠습니다\.?/gu, ' ')
    .replace(/확정\s*호텔은\s*별도\s*안내[^\n.]{0,72}/gu, ' ')
    .replace(/(?:미팅\s*장소|집결\s*장소|수하물\s*안내|출발\s*전\s*안내|소요\s*시간)\s*[:：]?\s*[^\n.]{0,56}/gi, ' ')
    .replace(/(?:편명|항공편)\s*[:：]\s*[^\n.]{0,24}/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return ''
  if (slot === 'sight' && /^(?:도착|출발)\s*후\s+/u.test(t)) {
    const rest = t.replace(/^(?:도착|출발)\s*후\s+/u, '').trim()
    if (rest.length >= 4 && /관광|방문|명소|시내|둘러보|전경|감상/u.test(rest)) {
      t = `${rest}, 도착 후`.replace(/\s+/g, ' ').trim()
    }
  }
  return t
}

function joinSightChunks(chunks: string[]): string {
  if (chunks.length === 0) return ''
  if (chunks.length === 1) return chunks[0]!
  return chunks
    .map((c) => c.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(', ')
    .replace(/\s+/g, ' ')
    .trim()
}

function composeReturnDayNarrative(metas: UnitMeta[]): string {
  const parts = metas
    .map((m) => normalizeVerygoodNarrativeClause(m.u, m.slot))
    .filter((x): x is string => Boolean(x && x.length > 1))
  const blob = parts.join(' ')
  const hasAirportMove =
    (/공항\s*으로|공항으로|터미널/u.test(blob) && /이동|으로\s*이동/u.test(blob)) ||
    /공항으로\s*이동/u.test(blob)
  const hasBoard = /탑승|출국|귀국\s*편|체크인|출발/u.test(blob)
  const hasIncheonArrival = /인천/u.test(blob) && /도착|입국/u.test(blob)
  if (hasAirportMove && hasBoard && hasIncheonArrival) {
    return '공항으로 이동해 귀국편에 탑승합니다. 인천국제공항에 도착합니다.'
  }
  if (/인천국제공항[^\n]{0,120}도착/u.test(blob) || /인천[^\n]{0,24}도착[^\n]{0,40}(?:제1터미널|T1|ICN)/u.test(blob)) {
    return '인천국제공항에 도착합니다.'
  }
  if (hasAirportMove && hasIncheonArrival) {
    return '공항으로 이동합니다. 인천국제공항에 도착합니다.'
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function composeMovementCentricDay(
  flowM: UnitMeta[],
  closeM: UnitMeta[],
  sightM: UnitMeta[],
  freeM: UnitMeta[]
): string {
  const flows = flowM.map((m) => normalizeVerygoodNarrativeClause(m.u, m.slot)).filter(Boolean)
  const sights = sightM.map((m) => normalizeVerygoodNarrativeClause(m.u, m.slot)).filter(Boolean)
  const frees = freeM.map((m) => normalizeVerygoodNarrativeClause(m.u, m.slot)).filter(Boolean)
  const closes = closeM.map((m) => normalizeVerygoodNarrativeClause(m.u, m.slot)).filter(Boolean)
  const s0 = flows.length ? flows.join(' ') : ''
  const s1 = sights.length ? (s0 ? `이후 ${joinSightChunks(sights)}` : joinSightChunks(sights)) : ''
  const s2 = frees.length ? (s1 || s0 ? ` 이후 ${frees.join(' ')}` : frees.join(' ')) : ''
  let body = [s0, s1, s2].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  if (closes.length) {
    const c = closes.join(' ')
    body = body ? `${body}, 이후 ${c}` : c
  }
  return body.replace(/\s+/g, ' ').trim()
}

function composeSightCentricDay(
  sightM: UnitMeta[],
  freeM: UnitMeta[],
  flowM: UnitMeta[],
  closeM: UnitMeta[],
  opts: { isLastDay: boolean }
): string {
  const sights = sightM.map((m) => normalizeVerygoodNarrativeClause(m.u, m.slot)).filter(Boolean)
  const frees = freeM.map((m) => normalizeVerygoodNarrativeClause(m.u, m.slot)).filter(Boolean)
  const flows = flowM.map((m) => normalizeVerygoodNarrativeClause(m.u, m.slot)).filter(Boolean)
  const closes = closeM.map((m) => normalizeVerygoodNarrativeClause(m.u, m.slot)).filter(Boolean)

  let s = joinSightChunks(sights)
  if (frees.length) {
    const f = frees.join(' ')
    if (s) {
      if (/자유\s*시간|자유\s*일정|자유\s*활동/u.test(f)) {
        if (/둘러보|방문|관광|명소|전경|감상/u.test(s)) s += ` 둘러본 뒤 ${f}`
        else s += ` 관광 후 ${f}`
      } else {
        s += ` 관광 후 ${f}`
      }
    } else {
      s = f
    }
  }
  if (flows.length) {
    const fl = flows.join(' ')
    s = s ? `${s}, 이후 ${fl}` : fl
  }
  if (closes.length) {
    const c = closes.join(' ')
    if (/투숙|숙박|휴식|호텔/u.test(c)) s = s ? `${s}, 이동해 ${c}` : c
    else s = s ? `${s}, ${c}` : c
  }
  void opts
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * 의미 단위(metas)를 3~5문장 분량의 서술형 흐름으로 재조합한다(최종은 `finalizeVerygoodScheduleDescription`에서 상한 적용).
 * imageKeyword·스키마는 건드리지 않는다.
 */
function composeNarrativeVerygoodDayDescription(metas: UnitMeta[], opts: { isLastDay: boolean }): string {
  const flow = mergeMeaningUnitsIntoNarrativeFlow(metas, opts).map((m) => ({
    ...m,
    u: normalizeVerygoodNarrativeClause(m.u, m.slot),
  }))
  const usable = flow.filter((m) => m.u.length > 1)
  if (usable.length === 0) return ''

  if (opts.isLastDay) {
    const blob0 = usable.map((m) => m.u).join(' ')
    if (/인천국제공항[^\n]{0,120}도착/u.test(blob0)) {
      return '인천국제공항에 도착합니다.'
    }
  }

  if (opts.isLastDay && usable.every((m) => m.slot === 'closure' || isAirportClosureClause(m.u, m.slot))) {
    const r = composeReturnDayNarrative(usable)
    if (r) return r
  }

  const sightM = usable.filter((m) => m.slot === 'sight')
  const freeM = usable.filter((m) => m.slot === 'free')
  const flowM = usable.filter((m) => m.slot === 'flow')
  const closeM = usable.filter((m) => m.slot === 'closure')
  const hasSight = sightM.length > 0

  let body = ''
  if (!hasSight && (flowM.length > 0 || closeM.length > 0)) {
    body = composeMovementCentricDay(flowM, closeM, sightM, freeM)
  } else {
    body = composeSightCentricDay(sightM, freeM, flowM, closeM, opts)
  }
  if (!body) return joinVerygoodDescriptionClauses(usable.map((m) => m.u), opts)
  return body
}

/** 평서체 `~합니다` 계열로 정리하되 원문에 없는 사실 문장은 붙이지 않는다. */
function finalizeVerygoodNarrativeTone(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim()
  if (!t) return t
  t = t.replace(/,\s*도착\s*후\s*,/gu, ', 도착 후').replace(/,\s*,/g, ',')
  if (!/[.!?。．]$/u.test(t)) {
    if (/합니다|입니다|됩니다|집니다|맞습니다|탑승합니다|도착합니다|휴식합니다|이동합니다/u.test(t) && !t.endsWith('.'))
      t = `${t}.`
  }
  return t.replace(/\s+/g, ' ').trim()
}

function buildSummaryFromDeterministicRaw(raw: string, opts: { isLastDay: boolean }): string {
  const metas = collectUnitMetas(raw).filter((m) => !/^[-–—•]+$/.test(m.u.trim()))
  if (metas.length === 0) return ''
  const picked = selectDiverseMeaningUnitMetas(metas, opts)
  if (picked.length === 0) return joinVerygoodDescriptionClauses(metas.map((m) => m.u), opts)
  const nar = composeNarrativeVerygoodDayDescription(picked, opts)
  const toned = finalizeVerygoodNarrativeTone(nar)
  return toned || joinVerygoodDescriptionClauses(picked.map((p) => p.u), opts)
}

function polishDescriptionFromMergedText(text: string, opts: { isLastDay: boolean }): string {
  const metas = collectUnitMetas(text).filter((m) => !/^[-–—•]+$/.test(m.u.trim()))
  if (metas.length === 0) return stripVerygoodScheduleUiNoiseLines(text).replace(/\s+/g, ' ').trim()
  const picked = selectDiverseMeaningUnitMetas(metas, opts)
  if (picked.length === 0) return joinVerygoodDescriptionClauses(metas.map((m) => m.u), opts)
  const nar = composeNarrativeVerygoodDayDescription(picked, opts)
  const toned = finalizeVerygoodNarrativeTone(nar)
  return toned || joinVerygoodDescriptionClauses(picked.map((p) => p.u), opts)
}

export function narrativeCompactVerygoodDayDescription(raw: string, opts?: { isLastDay?: boolean }): string {
  const stripped = stripVerygoodScheduleUiNoiseLines(raw).trim()
  if (!stripped) return ''
  const isLastDay = coercePolishLastDayFlag(Boolean(opts?.isLastDay), raw, stripped)
  const flat = stripped.replace(/\s+/g, ' ')
  if (
    isLastDay &&
    /인천국제공항/u.test(flat) &&
    /제1터미널|ICN|T1\b/u.test(flat) &&
    /도착/u.test(flat) &&
    !/바르샤바\s*도착/u.test(flat) &&
    flat.length < 900
  ) {
    return finalizeVerygoodScheduleDescription('인천국제공항에 도착합니다.')
  }

  if (looksLikePastedBlockStructure(raw) || looksLikePastedBlockStructure(stripped)) {
    return finalizeVerygoodScheduleDescription(buildSummaryFromDeterministicRaw(stripped, { isLastDay }))
  }

  return finalizeVerygoodScheduleDescription(polishDescriptionFromMergedText(stripped, { isLastDay }))
}

/** Gemini 일정 요약이 merge에서 결정론 원문으로 덮어쓰이지 않도록 할 만큼 실질 내용이 있는지 */
export function verygoodGeminiScheduleDescriptionWinsMerge(gsRaw: string): boolean {
  const gs = stripVerygoodScheduleUiNoiseLines(gsRaw).trim()
  if (gs.length < 10) return false
  if (/^[\s\-–—•,.／/|※]+$/u.test(gs)) return false
  return true
}

/** 결정론 `d.description`을 요약 fallback으로 쓰기엔 노이즈·원문 덩어리가 과한 경우 */
function verygoodDeterministicDescriptionUnacceptableForFallback(ds: string): boolean {
  const u = ds.replace(/\s+/g, ' ').trim()
  if (!u) return true
  if (u.length > 720) return true
  const flowHits = (u.match(/(?:이후|도착\s*후|이동해|둘러본\s*뒤)/g) ?? []).length
  if (flowHits >= 5) return true
  if (/선택\s*관광|●\s*선택|선택관광/u.test(u)) return true
  if (/호텔\s*투숙|투숙\s*및\s*휴식|호텔에서\s*휴식/u.test(u)) return true
  if (/※\s*현지|현지\s*상황|여행\s*일정\s*변경/u.test(u)) return true
  if (/(?:항공편|출발\s*전\s*안내|출발\s*안내)/u.test(u) && flowHits >= 2) return true
  if ((u.match(/\d{1,2}:\d{2}/g) ?? []).length >= 9) return true
  return false
}

export function pickMergedVerygoodDayDescription(
  g: RegisterScheduleDay,
  d: RegisterScheduleDay | undefined,
  opts?: { isLastDay?: boolean }
): string {
  const gsRaw = (g.description ?? '').trim()
  const dsRaw = (d?.description ?? '').trim()
  const gs = stripVerygoodScheduleUiNoiseLines(gsRaw).trim()
  const isLastDay = coercePolishLastDayFlag(Boolean(opts?.isLastDay), gsRaw, dsRaw)

  const fromGemini = () => narrativeCompactVerygoodDayDescription(gsRaw, { isLastDay })

  if (verygoodGeminiScheduleDescriptionWinsMerge(gsRaw)) {
    return fromGemini()
  }

  if (!d || !dsRaw) {
    if (!gs) return ''
    return fromGemini()
  }

  const dsClean = stripVerygoodScheduleUiNoiseLines(dsRaw).trim()
  if (!gs) {
    if (verygoodDeterministicDescriptionUnacceptableForFallback(dsClean)) return ''
    return narrativeCompactVerygoodDayDescription(dsRaw, { isLastDay })
  }

  if (verygoodDeterministicDescriptionUnacceptableForFallback(dsClean)) {
    return fromGemini()
  }

  const fromDet = narrativeCompactVerygoodDayDescription(dsRaw, { isLastDay })
  if (fromDet.trim()) return fromDet
  return fromGemini()
}

export function polishVerygoodRegisterScheduleDescriptions(schedule: RegisterScheduleDay[]): RegisterScheduleDay[] {
  if (!schedule?.length) return schedule
  const maxDay = Math.max(...schedule.map((s) => Number(s.day) || 0))
  return schedule.map((row) => {
    const day = Number(row.day) || 0
    // 일차만 있는 스케줄은 `day===maxDay`가 곧바로 true가 되어 귀국일(flow 상한 1)로 오인되므로, 2일차 이상일 때만 마지막 일로 본다.
    const isLastDay = maxDay > 1 && day === maxDay
    const raw = row.description ?? ''
    const desc = narrativeCompactVerygoodDayDescription(raw, { isLastDay })
    const titleNext = formatVerygoodOneLineVisitTitle(String(row.title ?? ''), raw, { isLastDay })
    return { ...row, title: titleNext || String(row.title ?? '').trim(), description: desc }
  })
}
