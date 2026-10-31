/**
 * 톤 1031(봉실장 23:50): 패키지 자유일정 추천일정 — 제미나이 제목·동선·요약 사후 검사.
 * 프롬프트 규칙(BONGTOUR_FREE_DAY_VOICE_BLOCK)만으로는 숫자·금지어·숙소 근처 표현을 막지 못해 코드로 한 번 더 본다.
 * 검사만 한다. 문장을 고치거나 다른 문장으로 바꾸지 않는다(실패한 날은 호출부가 저장하지 않음).
 * 기준은 /workspace/live/fit-tone-sample-1031/postcheck.py 와 같다(제목 앞머리 '추천일정 1day/반나절'의 숫자는 제외 — regen2 B D3 오탐).
 */
import { BONGTOUR_FREE_DAY_BANNED_WORDS } from '@/lib/bongtour-free-day-voice-block'

/** 제목 고정 앞머리 — 코드가 추천일정 여부를 판단하는 문구라 숫자로 치지 않는다 */
const FREE_DAY_TITLE_FIXED_PREFIX_RE = /추천일정\s*(?:1\s*day|반나절)/giu

/** 숫자가 이름 안에 있는 고유명사(상품 정보에 그대로 있는 이름) — 숫자 검사에서 뺀다 */
const FREE_DAY_NUMBER_NAME_WHITELIST: readonly string[] = ['아베노 하루카스 300', '하루카스 300']

/** 아라비아 숫자(전각 포함) 또는 우리말 수 + 단위('분'은 '한 분' 같은 사람 세기와 겹쳐 뺌 — 아라비아 숫자 '30분'은 앞 패턴이 잡음) */
const FREE_DAY_NUMBER_RE =
  /[0-9０-９]|(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|스물|서른|십|이십|삼십|사십|오십|백|천|만)\s*(?:시간|원|엔|달러|층|정거장|km|킬로|미터|일권|박)/u

const FREE_DAY_LODGE_RE = /숙소|호텔/u
const FREE_DAY_NEAR_RE = /가까운|가깝|근처|바로\s*옆|바로\s*앞|코앞|걸어서\s*금방/u

export type BongtourFreeDayPostcheckIssue =
  | { kind: 'number'; field: string; match: string }
  | { kind: 'banned_word'; field: string; match: string }
  | { kind: 'lodging_near_unknown_hotel'; field: string; match: string }

export type BongtourFreeDayPostcheckInput = {
  title?: string | null
  recommendedRoute?: string | null
  summary?: string | null
  /** 호텔 주소·위치를 알 때만 true. 패키지 자유일정은 주소가 없으므로 기본 false */
  hotelKnown?: boolean
}

function splitSentences(t: string): string[] {
  return t
    .split(/(?<=[.!?。])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean)
}

function findBannedWord(text: string): string | null {
  for (const w of BONGTOUR_FREE_DAY_BANNED_WORDS) {
    if (w === '유일') {
      // '자유일정'의 '유일'은 금지어가 아님
      if (/(?<!자)유일(?!정)/u.test(text)) return w
      continue
    }
    if (text.includes(w)) return w
  }
  return null
}

/** 한 칸 검사 — 문제 목록(비면 통과). 입력 문장은 바꾸지 않는다. */
export function checkBongtourFreeDayText(
  field: string,
  raw: string | null | undefined,
  opts: { hotelKnown?: boolean; isTitle?: boolean } = {},
): BongtourFreeDayPostcheckIssue[] {
  const text = String(raw ?? '').trim()
  if (!text) return []
  const issues: BongtourFreeDayPostcheckIssue[] = []
  let probe = text
  for (const w of FREE_DAY_NUMBER_NAME_WHITELIST) probe = probe.split(w).join('')
  if (opts.isTitle) probe = probe.replace(FREE_DAY_TITLE_FIXED_PREFIX_RE, '추천일정')
  const num = FREE_DAY_NUMBER_RE.exec(probe)
  if (num) {
    issues.push({ kind: 'number', field, match: probe.slice(Math.max(0, num.index - 6), num.index + num[0].length + 4) })
  }
  const banned = findBannedWord(text)
  if (banned) issues.push({ kind: 'banned_word', field, match: banned })
  if (!opts.hotelKnown) {
    for (const s of splitSentences(text)) {
      if (FREE_DAY_LODGE_RE.test(s) && FREE_DAY_NEAR_RE.test(s)) {
        issues.push({ kind: 'lodging_near_unknown_hotel', field, match: s.slice(0, 40) })
        break
      }
    }
  }
  return issues
}

/** 자유일정 추천일정 하루치(제목·동선·요약) 검사. ok=false 면 저장하지 않는다. */
export function postcheckBongtourFreeDayItinerary(input: BongtourFreeDayPostcheckInput): {
  ok: boolean
  issues: BongtourFreeDayPostcheckIssue[]
} {
  const hotelKnown = input.hotelKnown === true
  const issues = [
    ...checkBongtourFreeDayText('title', input.title, { hotelKnown, isTitle: true }),
    ...checkBongtourFreeDayText('recommendedRoute', input.recommendedRoute, { hotelKnown }),
    ...checkBongtourFreeDayText('summary', input.summary, { hotelKnown }),
  ]
  return { ok: issues.length === 0, issues }
}
