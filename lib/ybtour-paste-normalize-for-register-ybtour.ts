/**
 * 노란풍선(ybtour) 관리자 붙여넣기 — 일정 분할·필드 추출용 전처리.
 */
const UI_DROP = /^(더보기|상품\s*이미지|간략\s*일정\s*더\s*보기|상품\s*안내\s*더\s*보기|약관\s*\/\s*취소수수료\s*더\s*보기|문의|인쇄|찜|공유|복사|URL|단축)$/i

const ITIN_END = [
  /^\s*리뷰\s*\(/i,
  /^\s*상품가격\s*$/,
  /^\s*총\s*금액\b/,
  /^\s*오늘의\s*날씨\s*$/,
  /^\s*현지\s*시각\s*$/,
  /^\s*포함\s*\/\s*불포함\s*\/\s*약관/i,
  /^\s*약관\s*\/\s*취소수수료/i,
]

export function normalizeYbtourRegisterPasteLineEndings(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/** 일정 추출용: UI 줄 제거·연속 공백 축소(탭→공백은 detail-body 쪽과 별도). */
export function normalizeYbtourPasteForScheduleExtract(raw: string): string {
  const lines = normalizeYbtourRegisterPasteLineEndings(raw).split('\n')
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) {
      out.push('')
      continue
    }
    if (UI_DROP.test(t)) continue
    out.push(t.replace(/[ \u00a0]{2,}/g, ' '))
  }
  return out.join('\n').replace(/\n{4,}/g, '\n\n\n')
}

/** `여행 일정` / `일차별 일정` / 첫 상세 `1일차` ~ 하단 앵커 직전 */
export function sliceYbtourItineraryBodyForDayMarkers(raw: string): string {
  const full = normalizeYbtourRegisterPasteLineEndings(raw)
  const labelIdx = (re: RegExp) => {
    const m = re.exec(full)
    return m ? m.index : -1
  }
  const idxTravel = labelIdx(/여행\s*일정/)
  const idxDayList = labelIdx(/일차별\s*일정/)
  const firstDetailed1 = (() => {
    const re =
      /(?:^|\n)\s*1\s*일차\s*(?:\n\s*(?:\d{4}[./]\d{2}[./]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일)|\n)/m
    const m = re.exec(full)
    return m ? m.index : -1
  })()
  let start = 0
  const cands = [idxTravel, idxDayList, firstDetailed1].filter((i) => i >= 0)
  if (cands.length) start = Math.min(...cands)

  let end = full.length
  const from = full.slice(start)
  const lines = from.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.replace(/\s+/g, ' ').trim()
    if (!t) continue
    if (ITIN_END.some((re) => re.test(t))) {
      end = start + lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0)
      break
    }
  }
  return full.slice(start, end).trim()
}
