/**
 * 상담 페이지용: 일정 title/description·요약·식사 줄에서 약관·취소·예약금·결제 전제 문구 제거.
 * 항공 일정·공항·편명·출발/도착 서술은 보존한다(패턴은 약관·취소 규정 본문 위주).
 *
 * 각 공급사 schedule/초안 파이프에서만 import — 비즈니스 규칙 병합용이 아님.
 */

/** 한글에서는 \\b 경계가 거의 동작하지 않아 약관 절 제거가 누락된다 — \\b 없이 구간 매칭 */
const INLINE_CLAUSE_RE: RegExp[] = [
  /국외여행\s*표준약관[^。.\n]{0,240}[。.]?/gi,
  /국내여행\s*표준약관[^。.\n]{0,240}[。.]?/gi,
  /특별약관[^。.\n]{0,200}(?:적용|동의|절차)[^。.\n]{0,120}[。.]?/gi,
  /본\s*상품의\s*예약과\s*취소는[^。.\n]{0,200}[。.]?/gi,
  /약관\([^)]*\)\s*에\s*따라[^。.\n]{0,160}[。.]?/gi,
  /예약금\s*\d{1,3}(?:,\d{3})*\s*원[^。.\n]{0,120}[。.]?/gi,
  /계약금\s*환불[^。.\n]{0,120}[。.]?/gi,
  /취소\s*위약금[^。.\n]{0,160}[。.]?/gi,
  /기간에\s*따른\s*환불규정[^。.\n]{0,120}[。.]?/gi,
  /‘기간에\s*따른\s*취소환불규정’[^。.\n]{0,80}[。.]?/gi,
  /취소환불규정[^。.\n]{0,40}[。.]?/gi,
  /발권\s*후\s*취소\s*패널티[^。.\n]{0,120}[。.]?/gi,
  /항공권\s*발권\s*이후[^。.\n]{0,200}[。.]?/gi,
  /항공권\s*발권이후[^。.\n]{0,200}[。.]?/gi,
  /여행요금의\s*\d{1,3}\s*%\s*배상[^。.\n]{0,40}[。.]?/gi,
  /배상하여야\s*합니다[^。.\n]{0,20}[。.]?/gi,
]

function dropWholeLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (t.length > 500) return false
  // 섹션 헤더·탭
  if (/^(■|▣|※|#|•|\*|▪)\s*(약관|취소수수료|특별약관|예약금|계약금|환불규정|위약금|취소료|결제)/.test(t)) return true
  if (/^(약관|취소수수료|특별약관|예약금|계약금|환불규정)\s*(\/|｜|\|)?\s*(취소수수료|약관|더\s*보기|보기)?\s*$/i.test(t))
    return true
  if (/약관\s*\/\s*취소수수료/.test(t) && t.length < 80) return true
  if (/국외여행\s*표준약관\s*제\s*\d+\s*조/.test(t)) return true
  if (/여행\s*취소\s*시\s*국외여행\s*표준약관/.test(t)) return true
  if (/취소수수료\s*규정|예약금\s*규정|■\s*취소|■\s*예약금|▣\s*예약/.test(t)) return true
  if (/예약\s*후\s*\d{1,2}\s*시간\s*내.*예약금/.test(t)) return true
  if (/업무시간|근무시간.*\d{1,2}:\d{2}.*취소.*불가/.test(t)) return true
  if (/토\s*\/\s*일\s*\/\s*월\s*출발.*취소/.test(t)) return true
  if (/해당\s*여행상품은\s*\[?국외여행\s*특별약관\]?\s*이\s*적용/.test(t)) return true
  if (/상기\s*상품은\s*국외여행\s*표준약관.*특별약관/.test(t)) return true
  if (/여행개시\s*~\s*\d+\s*일전까지\s*취소\s*통보/.test(t)) return true
  if (/취소\s*통보\s*시\s*:\s*예약금/.test(t)) return true
  if (/취소료가\s*부과|비율로\s*취소료/.test(t)) return true
  if (/당사의\s*귀책사유로\s*여행출발\s*취소/.test(t)) return true
  // 표준약관 변경 고지(일정표 상단 장문)
  if (/국외여행\s*표준약관\s*제\s*12\s*조|여행일정은\s*계약체결\s*시\s*예상하지\s*못한/.test(t)) return true
  if (/^본\s*상품의\s*예약과\s*취소는\s*국외여행\s*표준약관/.test(t)) return true
  if (/^(계약금|취소료|취소수수료)\s*규정\s*$/.test(t)) return true
  if (/^[-–]\s*단,\s*항공권\s*발권/.test(t)) return true
  if (/개런티예약의\s*경우는\s*예약담당자/.test(t)) return true
  if (/당사는\s*여행참가자\s*수\s*미달로\s*전항의\s*기일내\s*통지를\s*하지\s*아니하고\s*계약을\s*해제하는\s*경우/.test(t))
    return true
  if (/^가\.\s*여행개시\s*\d+\s*일전까지\s*여행계약\s*해제\s*통지시\s*:\s*계약금\s*환불/.test(t)) return true
  if (/^나\.\s*여행출발\s*\d+\s*일전까지\s*통지시\s*:\s*여행요금의\s*\d+\s*%\s*배상/.test(t)) return true
  if (/^다\.\s*여행출발\s*당일\s*통지시\s*:\s*여행요금의\s*\d+\s*%\s*배상/.test(t)) return true
  if (/^③\s*예약금\s*입금\s*후\s*개인사정으로\s*인한\s*취소\s*시에는/.test(t)) return true
  if (/^④\s*기간별\s*취소료\s*규정과\s*상관없이\s*항공사\s*및\s*호텔의\s*자체\s*규정/.test(t)) return true
  if (/^⑤\s*일부\s*그룹항공권\s*이용\s*상품의\s*경우\s*항공데파짓/.test(t)) return true
  return false
}

function stripInlineClauses(s: string): string {
  let o = s
  for (const re of INLINE_CLAUSE_RE) {
    o = o.replace(re, ' ')
  }
  return o
}

/**
 * 일정용 한 덩어리 텍스트에서 약관성 문구 제거. 항공·관광 본문은 대부분 유지.
 */
export function stripCounselingTermsFromScheduleText(s: string): string {
  if (!s?.trim()) return ''
  let t = s.replace(/\r\n/g, '\n')
  const lines = t.split('\n')
  const kept: string[] = []
  for (const line of lines) {
    if (dropWholeLine(line)) continue
    kept.push(line)
  }
  t = kept.join('\n')
  t = stripInlineClauses(t)
  t = t.replace(/[ \t\u3000]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return t
}

type ScheduleRowLike = {
  title?: string
  description?: string
  mealSummaryText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
}

/** schedule 행 단위(공급사 스키마 공통 필드) */
export function stripCounselingTermsFromScheduleRow<T extends ScheduleRowLike>(row: T): T {
  const title = stripCounselingTermsFromScheduleText(String(row.title ?? ''))
  const description = stripCounselingTermsFromScheduleText(String(row.description ?? ''))
  const mealSummaryText =
    row.mealSummaryText != null ? stripCounselingTermsFromScheduleText(String(row.mealSummaryText)) || null : null
  const breakfastText =
    row.breakfastText != null ? stripCounselingTermsFromScheduleText(String(row.breakfastText)) || null : null
  const lunchText = row.lunchText != null ? stripCounselingTermsFromScheduleText(String(row.lunchText)) || null : null
  const dinnerText = row.dinnerText != null ? stripCounselingTermsFromScheduleText(String(row.dinnerText)) || null : null
  return {
    ...row,
    title,
    description,
    mealSummaryText,
    breakfastText,
    lunchText,
    dinnerText,
  }
}

/** registerScheduleToDayInputs 결과(요약·rawBlock·식사 문자열) */
export type ItineraryDayDraftLike = {
  summaryTextRaw?: string | null
  rawBlock?: string | null
  mealSummaryText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  meals?: string | null
}

export function stripCounselingTermsFromItineraryDayDraft<T extends ItineraryDayDraftLike>(d: T): T {
  const summaryTextRaw = stripCounselingTermsFromScheduleText(String(d.summaryTextRaw ?? '')) || null
  let rawBlock: string | null | undefined = d.rawBlock
  if (typeof rawBlock === 'string' && rawBlock.trim()) {
    try {
      const o = JSON.parse(rawBlock) as Record<string, unknown>
      if (typeof o.title === 'string') o.title = stripCounselingTermsFromScheduleText(o.title)
      if (typeof o.description === 'string') o.description = stripCounselingTermsFromScheduleText(o.description)
      rawBlock = JSON.stringify(o)
    } catch {
      rawBlock = stripCounselingTermsFromScheduleText(rawBlock)
    }
  }
  return {
    ...d,
    summaryTextRaw,
    rawBlock: rawBlock ?? null,
    mealSummaryText:
      d.mealSummaryText != null ? stripCounselingTermsFromScheduleText(String(d.mealSummaryText)) || null : null,
    breakfastText:
      d.breakfastText != null ? stripCounselingTermsFromScheduleText(String(d.breakfastText)) || null : null,
    lunchText: d.lunchText != null ? stripCounselingTermsFromScheduleText(String(d.lunchText)) || null : null,
    dinnerText: d.dinnerText != null ? stripCounselingTermsFromScheduleText(String(d.dinnerText)) || null : null,
    meals: d.meals != null ? stripCounselingTermsFromScheduleText(String(d.meals)) || null : null,
  }
}
