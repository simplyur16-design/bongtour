/**
 * REGRESSION-FREEZE[register-schedule-row-fragment-filter]: 일정 제목·경로·설명에서 안내문·요금 조각, 숙소이름만 제목, 깨진 제목 제거 — manifest
 * (round3 봉실장 21:35) 조각만 뺀다 — 빠진 자리에 새 문장을 지어내지 않는다.
 */

/** 요금·객실 조각: '000원/인', '3인/1실 이용시', '트윈베드에 간이침대' … */
const FARE_FRAGMENT_RE =
  /\d?[,.]?0{3}\s*원\s*\)?\s*(?:\/|과)\s*인|원\s*\/\s*인|\d\s*인\s*\/\s*\d\s*실|간이\s*침대|트윈\s*베드|싱글\s*차지|추가\s*요금|요금\s*(?:안내|추가|별도)|객실\s*(?:업그레이드|추가|배정)/u

/** 공급사 안내문 조각: 결제·취소 문자, 앱 설치 안내, 'Customs.', 참고사항·상세보기 등 */
const NOTICE_FRAGMENT_RE =
  /결제\s*취소|취소\s*문자|문자가\s*(?:가지|발송|오지)|어플\s*(?:다운|설치)|앱\s*(?:다운|설치)|다운로드\s*후|\bCustoms\b|참고\s*사항|상세\s*보기|자세히\s*보기|유의\s*사항|안내\s*사항|필독|예약\s*시\s|연중\s*무휴|24\s*시간\s*이용|헬스장|가이드\s*(?:경비|팁)|매너\s*팁|현지\s*사정에\s*따라|변경될\s*수\s*있|입국\s*신고서|전자\s*입국/iu

export function isRegisterScheduleNoticeOrFareFragment(text: string | null | undefined): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  return FARE_FRAGMENT_RE.test(t) || NOTICE_FRAGMENT_RE.test(t)
}

const hotelKey = (s: string) => s.replace(/[\s·,，()（）\[\]_\-]/gu, '').toLowerCase()

/** 그날 숙소명과 같은 말인지 (호텔 단어가 없는 '미카즈키' 같은 숙소명 포함) */
export function isRegisterScheduleDayHotelNameLabel(label: string, hotelText: string | null | undefined): boolean {
  const t = hotelKey(String(label ?? ''))
  if (!t) return false
  return String(hotelText ?? '')
    .split(/\s*\/\s*|\s+또는\s+|\s+or\s+/iu)
    .map(hotelKey)
    .some((h) => h.length >= 3 && (h === t || (t.length >= 4 && h.includes(t)) || (h.length >= 4 && t.includes(h) && t.length <= h.length + 2)))
}

/** 깨진 제목 조각 손질: 짝 없는 괄호·앞뒤 구두점 제거, 남는 게 없거나 기호·숫자뿐이면 '' */
export function repairRegisterScheduleBrokenTitlePart(part: string): string {
  let t = String(part ?? '').replace(/\s+/g, ' ').trim()
  for (let i = 0; i < 3; i++) {
    const before = t
    if ((t.match(/\(/g)?.length ?? 0) !== (t.match(/\)/g)?.length ?? 0)) {
      // 짝 없는 괄호: 여는 괄호만 있으면 그 뒤를, 닫는 괄호만 있으면 그 앞까지를 조각으로 본다
      const open = t.lastIndexOf('(')
      const close = t.indexOf(')')
      if (close >= 0 && (open < 0 || close < open)) t = t.slice(close + 1)
      else if (open >= 0) t = t.slice(0, open)
    }
    t = t.replace(/^[\s)\]\-·,/:;~|]+|[\s(\[\-·,/:;~|]+$/gu, '').trim()
    if (t === before) break
  }
  if (!t || /^[\d\s\p{P}\p{S}_]+$/u.test(t)) return ''
  return t
}

/** 밑줄 별칭: '이색체험_전통객잔숙박' 같은 내부 코드·별칭 (round3 22:03) */
export function isRegisterScheduleUnderscoreAliasLabel(label: string | null | undefined): boolean {
  return /[가-힣A-Za-z0-9]_+[가-힣A-Za-z0-9\p{Script=Han}]/u.test(String(label ?? ''))
}

/**
 * 밑줄 뒤가 한자 원어·사진 출처('六合夜市', '관광청제공')면 앞 이름만 남기고, 그 밖의 밑줄 별칭은 통째로 뺀다('' 반환).
 * 밑줄이 없으면 그대로.
 */
export function cleanRegisterScheduleUnderscoreAlias(label: string): string {
  const t = String(label ?? '').trim()
  if (!isRegisterScheduleUnderscoreAliasLabel(t)) return t
  const m = /^(.+?)_+(.+)$/u.exec(t)
  if (!m) return ''
  const [, head, tail] = m
  if (/^[\p{Script=Han}\s]+$/u.test(tail!) || /제공|출처|사진|photo|credit/iu.test(tail!)) return head!.trim()
  return ''
}

/**
 * 중복 문구 빼기: 같은 말이 두 번이면 하나만, 짧은 쪽이 긴 쪽의 첫 낱말(띄어쓰기 경계)이면 긴 쪽만
 * ('두가 · 두가 유적지 관람' → '두가 유적지 관람'). '오사카 · 오사카성' 처럼 붙은 말은 그대로.
 */
export function dedupeRegisterScheduleLabelParts(parts: string[]): string[] {
  const key = (x: string) => x.replace(/\s+/g, ' ').trim().toLowerCase()
  const out: string[] = []
  for (const p of parts) {
    const k = key(p)
    if (!k || out.some((o) => key(o) === k)) continue
    out.push(p)
  }
  return out.filter((p) => {
    const k = key(p)
    return !out.some((o) => o !== p && key(o).startsWith(`${k} `))
  })
}

const ROUTE_SPLIT_RE = /\s+-\s+/u
const TITLE_SPLIT_RE = /\s+·\s+/u

export type RegisterScheduleFragmentRow = {
  title?: string | null
  routeText?: string | null
  description?: string | null
  hotelText?: string | null
}

/** 설명: 안내문·요금 조각이 든 문장만 뺀다 */
export function stripRegisterScheduleFragmentSentences(text: string | null | undefined): string {
  const src = String(text ?? '').trim()
  if (!src) return src
  const sents = src.split(/(?<=[.!?。])\s+|\n+/u).map((s) => s.trim()).filter(Boolean)
  const kept = sents.filter((s) => !isRegisterScheduleNoticeOrFareFragment(s))
  return kept.length === sents.length ? src : kept.join(' ')
}

/**
 * 한 일차의 제목·경로·설명에서 조각을 뺀다. 빈 제목은 ''로 두어 다음 단계(도시·목적지 도시 제목)가 채운다.
 * 원문 일정 문장이 없으면 조각만 빠지고 새 문장은 만들지 않는다.
 */
export function stripRegisterScheduleRowFragments<T extends RegisterScheduleFragmentRow>(row: T): T {
  const hotel = row.hotelText ?? null
  const routeIn = String(row.routeText ?? '')
  const routeSegs = routeIn.split(ROUTE_SPLIT_RE).map((s) => s.trim()).filter(Boolean)
  const routeKept = dedupeRegisterScheduleLabelParts(
    routeSegs
      .map(cleanRegisterScheduleUnderscoreAlias)
      .filter((s) => s && !isRegisterScheduleNoticeOrFareFragment(s) && !isRegisterScheduleDayHotelNameLabel(s, hotel)),
  )
  const titleIn = String(row.title ?? '')
  const titleParts = titleIn.split(TITLE_SPLIT_RE).map((s) => s.trim()).filter(Boolean)
  const titleKept = dedupeRegisterScheduleLabelParts(
    titleParts
      .map(cleanRegisterScheduleUnderscoreAlias)
      .filter((s) => s && !isRegisterScheduleNoticeOrFareFragment(s) && !isRegisterScheduleDayHotelNameLabel(s, hotel))
      .map(repairRegisterScheduleBrokenTitlePart)
      .filter(Boolean),
  )
  const next: T = { ...row }
  if (routeKept.join(' - ') !== routeSegs.join(' - ')) next.routeText = routeKept.join(' - ')
  const titleOut = titleKept.join(' · ')
  if (titleOut !== titleIn.trim()) next.title = titleOut
  if (row.description != null) {
    const d = stripRegisterScheduleFragmentSentences(row.description)
    if (d !== String(row.description).trim()) next.description = d
  }
  return next
}

/**
 * AI 팁 문장 (원문에 없는 권유·당부): '~해 보세요', '~챙기세요', '~수 있어요', '~좋아요' 등 (round3 22:03).
 * 원문 문장인지는 부르는 쪽이 확인한다 — 이 판별은 원문에 없는 문장에만 쓴다.
 */
const AI_TIP_SENTENCE_RE =
  /(?:보세요|하세요|마세요|즐기세요|챙기세요|드세요|가세요|맞이하세요|마무리하세요|느껴\s*보세요|추천(?:해요|합니다|드려요|드립니다)|수\s*있어요|좋아요|좋습니다|좋겠어요|있으니|바랍니다|잊지\s*마|참고하세요|주의하세요)[.!]?$/u

export function isRegisterScheduleAiTipSentence(sentence: string | null | undefined): boolean {
  return AI_TIP_SENTENCE_RE.test(String(sentence ?? '').trim())
}
