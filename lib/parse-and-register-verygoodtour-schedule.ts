/**
 * 참좋은여행 등록 파이프: 일정 표현층만 보정.
 * @see docs/register_schedule_expression_ssot.md
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'
import { stripCounselingTermsFromScheduleRow } from '@/lib/itinerary-counseling-terms-strip'
import {
  coerceScheduleDayToOneBased,
  normalizeDay,
  registerScheduleToDayInputs,
  type ItineraryDayInput,
} from '@/lib/upsert-itinerary-days-verygoodtour'

// --- 일정 일차 title A-B-C 후처리 (노랑풍선 ybtour-schedule-day-header-title.ts 로직 복사·독립) ---
const _verygoodtour_DAY_N_TRAVEL = /^day\s*\d+\s*travel$/i
const _verygoodtour_SENTENCE_TAIL = /(?:습니다|읍니다|합니다|예정입니다|입니다|했습니다|갑니다)\s*\.?\s*$/u
const _verygoodtour_MEAL_HOTEL = /호텔|리조트|조식|중식|석식|식사\s*[:：]|예정\s*호텔|쇼핑|면세|공항\s*픽업/
const _verygoodtour_BAN_TITLE = /동유럽\s*\d+\s*개국|유럽\s*\d+\s*개국|아시아\s*\d+\s*개국/

const _verygoodtour_PLACE_NAMES: string[] = `체스키크룸로프 잘츠부르크 브로츠와프 부다페스트 할슈타트 슈트루브 그린델발트 인터라켄 취리히 제네바 루체른 베네치아 피렌체 로마 밀라노 바티칸 파리 니스 마르세유 런던 맨체스터 에든버러 더블린 바르셀로나 마드리드 세비야 리스본 포르투 베를린 뮌헨 프랑크푸르트 쾰른 드레스덴 함부르크 비엔나 프라하 크라쿠프 바르샤바 부카레스트 소피아 자그레브 류블랴나 베오그라드 스코페 티라나 두브로브니크 스플리트 자다르 암스테르담 브뤼셀 룩셈부르크 코펜하겐 스톡홀름 오슬로 헬싱키 레이캬비크 모스크바 상트페테르부르크 트로무소 올로모우츠 인천 김포 서울 부산 대구 제주 울산 광주 여수 강릉 속초 동해 포항 가고시마 오키나와 나하 이시가키 미야코지마 도쿄 요코하마 가마쿠라 하코네 닛코 후지 오사카 교토 고베 나라 삿포로 오타루 하코다테 아오모리 센다이 나고야 다카야마 시라카와고 가나자와 후쿠오카 유후인 벳부 구마모토 나가사키 상해 북경 서안 청두 충칭 광저우 선전 항저우 소주 남경 청도 연길 장춘 하얼빈 다롄 천진 홍콩 마카오 타이페이 타오위안 화련 타이중 가오슝 지우펀 켄팅 방콕 치앙마이 치앙라이 파타야 후아힌 끄라비 푸켓 코사무이 다낭 호이안 하노이 하롱 호치민 달랏 나짱 푸꾸옥 발리 자카르타 쿠알라룸푸르 페낭 랑카위 코타키나발루 싱가포르 시드니 멜버른 골드코스트 케언즈 퍼스 뉴욕 워싱턴 시카고 밴쿠버 토론토 괌 사이판 호놀룰루 하와이`
  .split(/\s+/)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length)

function _verygoodtourCompactWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function _verygoodtourExtractPlacesInOrder(hay: string): string[] {
  const h = _verygoodtourCompactWs(hay)
  if (!h) return []
  const hits: Array<{ idx: number; name: string }> = []
  for (let i = 0; i < h.length; i++) {
    for (const name of _verygoodtour_PLACE_NAMES) {
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
    if (_verygoodtour_MEAL_HOTEL.test(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

function _verygoodtourFormatRoute(places: string[], hay: string): string {
  let seq = [...places]
  if (seq.length > 4) seq = seq.slice(0, 4)
  if (seq.length >= 2) return seq.join(' - ').slice(0, 120)
  if (seq.length === 1) {
    const only = seq[0]!
    if (only === '인천' && /도착|귀국|입국/u.test(hay)) return '인천 도착'
    return only
  }
  const firstSeg = hay
    .split(/[,，]/)
    .map((x) => x.trim())
    .find((frag) => {
      if (frag.length < 2 || frag.length > 36) return false
      if (_verygoodtour_MEAL_HOTEL.test(frag)) return false
      if (/^\d{4}[./]/.test(frag)) return false
      if (/출발|도착/.test(frag) && frag.length > 24) return false
      return /[가-힣]/.test(frag)
    })
  if (firstSeg) return firstSeg.replace(/^[\s\-–:]+/, '').slice(0, 60)
  return ''
}

function _verygoodtourShouldReplaceTitle(title: string, description: string): boolean {
  const t = title.replace(/\s+/g, ' ').trim()
  if (!t || t === '-' || t === '—' || t === '–') return true
  if (_verygoodtour_DAY_N_TRAVEL.test(t)) return true
  if (_verygoodtour_BAN_TITLE.test(t)) return true
  if (/^\d{4}[./-]\d{1,2}[./-]\d{1,2}/.test(t) && t.length < 18) return true
  if (t.length > 72) return true
  if (_verygoodtour_SENTENCE_TAIL.test(t) && t.length > 24) return true
  if (/^[\d\s\-–—·일차제]+$/u.test(t)) return true
  return false
}

function _verygoodtourDeriveHeaderTitle(day: number, title: string, description: string): string {
  const hay = _verygoodtourCompactWs(`${title}\n${description}`)
  if (!hay) return ''
  const places = _verygoodtourExtractPlacesInOrder(hay)
  const route = _verygoodtourFormatRoute(places, hay)
  if (route) return route
  const incheonOut = /인천\s*\(?\s*ICN\s*\)?\s*출발/u.test(hay)
  const firstForeign = places.find((p) => p !== '인천' && p !== '김포' && p !== '서울')
  if (day === 1 && incheonOut && firstForeign) return `인천 - ${firstForeign}`.slice(0, 120)
  return ''
}

const DAY_N_TRAVEL_RE = /^day\s*\d+\s*travel$/i

function isPlaceholderHotel(ht: string): boolean {
  const t = ht.trim()
  return !t || t === '-' || t === '—' || t === '–'
}

/** 공용 기본 imageKeyword `Day N travel` 제거·대체 (title → description → 빈 문자열) */
export function sanitizeVerygoodtourScheduleRowExpression(row: RegisterScheduleDay): RegisterScheduleDay {
  const kw = String(row.imageKeyword ?? '').trim()
  if (!DAY_N_TRAVEL_RE.test(kw)) return row
  const fromTitle = String(row.title ?? '').trim().slice(0, 120)
  const fromDesc = String(row.description ?? '').trim().slice(0, 120)
  const nextKw = fromTitle || fromDesc ? (fromTitle || fromDesc).slice(0, 120) : ''
  return { ...row, imageKeyword: nextKw }
}

export function augmentVerygoodtourScheduleExpressionParsed(parsed: RegisterParsed): RegisterParsed {
  const sched = parsed.schedule
  if (!sched?.length) return parsed
  return {
    ...parsed,
    schedule: sched.map((r) => {
      const base = sanitizeVerygoodtourScheduleRowExpression(stripCounselingTermsFromScheduleRow(r))
      const d = coerceScheduleDayToOneBased(base.day) ?? normalizeDay(base.day)
      const normalized = d != null && d >= 1 ? { ...base, day: d } : base
      const title = String(normalized.title ?? '').trim()
      const description = String(normalized.description ?? '').trim()
      if (!_verygoodtourShouldReplaceTitle(title, description)) return normalized
      const derived = _verygoodtourDeriveHeaderTitle(normalized.day, title, description).trim()
      if (!derived) return normalized
      return { ...normalized, title: derived.slice(0, 200) }
    }),
  }
}

/**
 * `parsed.schedule`를 ItineraryDay 초안의 단일 소스로 삼고, hotelText가 있으면 accommodation을 맞춘다.
 * schedule이 비어 있으면 기존 drafts를 그대로 둔다.
 */
export function finalizeVerygoodtourItineraryDayDraftsFromSchedule(
  _drafts: ItineraryDayInput[],
  schedule: RegisterScheduleDay[]
): ItineraryDayInput[] {
  if (!schedule?.length) return _drafts
  const fromSchedule = registerScheduleToDayInputs(schedule.map(stripCounselingTermsFromScheduleRow))
  return fromSchedule.map((d) => {
    const ht = d.hotelText?.trim()
    if (isPlaceholderHotel(ht ?? '')) return d
    return { ...d, accommodation: ht!.slice(0, 500) }
  })
}

/** confirm: 가격/항공만이 아니라 일정 표현층(일차 행 또는 실질 draft)이 있어야 함 */
export function verygoodConfirmHasScheduleExpressionLayer(
  parsed: RegisterParsed,
  drafts: ItineraryDayInput[]
): boolean {
  if ((parsed.schedule?.length ?? 0) > 0) return true
  return drafts.some((d) => {
    const s = String(d.summaryTextRaw ?? '').trim()
    if (s.length >= 8) return true
    const ht = d.hotelText?.trim()
    if (ht && !isPlaceholderHotel(ht)) return true
    const m = String(d.meals ?? '').trim()
    if (m.length > 0) return true
    return false
  })
}
