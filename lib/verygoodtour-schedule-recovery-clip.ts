/**
 * 참좋은여행 전용: 상품평·후기·날씨·가격·로그인 등 **마케팅 꼬리**를 잘라 LLM·섹션 파서 입력 토큰을 줄인다.
 * revision 값은 스냅샷 inputDigest·재현성 논의 시 함께 올린다.
 */
/** 일정표 위에 뜨는 `상품평점`/`여행후기` 단독 줄이 먼저 매칭되어 1일차~N일차가 잘리는 문제 방지 시 증가 */
export const VERYGOOD_LLM_INPUT_CLIP_REVISION = 2 as const

const TAIL_START_LINE_RES = [
  /^\s*상품평점\s*$/,
  /^\s*여행후기\s*$/,
  /** `고객상품평여행후기…` 한 줄(공백 없음) */
  /^\s*고객상품평/,
  /^\s*고객\s*상품평\s*$/,
  /^\s*고객평점\s*$/,
  /^\s*평균\s*별점\s*$/,
  /^\s*오늘의\s*날씨\s*$/,
  /^\s*현지\s*시각\s*$/,
  /^\s*상품가격\s*$/,
  /^\s*총\s*금액\b/,
  /^\s*무이자\s*할부\s*$/,
  /^\s*상품\s*문의\s*$/,
  /^\s*후기\s*작성\s*$/,
  /^\s*로그인\s*$/,
  /^\s*고객\s*평가\s*$/,
]

/** 참좋은 상세는 `상품평점`·`여행후기`가 일정표 **위**에도 나와, 여기서 자르면 `1일차`~`N일차`가 통째로 사라진다. */
function findFirstVerygoodScheduleDayLineIndex(lines: string[]): number {
  const idx = lines.findIndex((l) => /^\s*\d{1,2}일차\s*$/.test(l.trim()))
  if (idx >= 0) return idx
  return lines.findIndex((l) => /^\s*DAY\s*\d+\s*$/i.test(l.trim()))
}

/**
 * 첫 매칭 줄(포함) 이전만 유지. 일정표 **앞**에 있는 상품평/후기 헤더는 잘라내지 않는다(rev.2).
 */
export function clipVerygoodMarketingTailFromPaste(fullText: string): {
  clipped: string
  cutAtLine: string | null
  originalLen: number
} {
  const originalLen = fullText.length
  const lines = fullText.split(/\r?\n/)
  const firstDayLineIdx = findFirstVerygoodScheduleDayLineIndex(lines)
  let cutIdx: number | null = null
  let cutAtLine: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.replace(/\s+/g, ' ').trim()
    if (!t) continue
    if (firstDayLineIdx >= 0 && i < firstDayLineIdx) {
      continue
    }
    if (TAIL_START_LINE_RES.some((re) => re.test(t))) {
      cutIdx = i
      cutAtLine = t.slice(0, 80)
      break
    }
  }
  if (cutIdx == null || cutIdx < 1) {
    return { clipped: fullText, cutAtLine: null, originalLen }
  }
  const clipped = lines.slice(0, cutIdx).join('\n').trimEnd()
  /** 일정표가 없을 때만: 꼬리 한 줄에 잘못 걸려 본문이 거의 남지 않으면 clip 취소. `1일차` 이후에서 자른 짧은 본문은 유지한다. */
  if (clipped.length < 400 && firstDayLineIdx < 0) {
    return { clipped: fullText, cutAtLine: null, originalLen }
  }
  return { clipped, cutAtLine, originalLen }
}

/** @deprecated 이름 호환 — `clipVerygoodMarketingTailFromPaste`와 동일 */
export const clipVerygoodPasteForScheduleRecovery = clipVerygoodMarketingTailFromPaste
