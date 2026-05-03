/**
 * 모두투어: 붙여넣은 본문 텍스트만으로 일차 블록 분리 → RegisterParsed.schedule 보강 (HTML/DOM 미사용).
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-modetour'
import { isModetourPlaceholderImageKeyword } from '@/lib/modetour-schedule-image-keyword'

function modetourScheduleImageKeywordFallback(day: number): string {
  return `Day ${day} travel`
}

const NOISE_LINE =
  /더보기|크게\s*보기|크게보기|접기|펼치기|후기\s*작성|리뷰\s*작성|좋아요|공유하기|공유|배너|이벤트\s*응모|예약하기\s*버튼|바로가기|^\s*click\s|placeholder|\[이미지\]|img\s*\d|이미지\s*첨부|이미지\s*확대|광고|개인정보\s*처리|이용약관|쿠키\s*설정|단독\s*예약|조기\s*마감|한정\s*특가|프로모션\s*안내/i

function isDayNTravelKeyword(s: string): boolean {
  return isModetourPlaceholderImageKeyword(s)
}

/** 일정 블록 밖으로 밀어낼 상품 푸터·안내 헤더 (day 본문에 남기지 않음) */
function isModetourScheduleTailBreakLine(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (/^더보기$/i.test(t) || /^크게\s*보기$/i.test(t) || /^image$/i.test(t) || /^\[?이미지\]?\s*$/i.test(t)) return true
  if (/^(?:※\s*)?유의\s*[｜|Iil1]\s*안내\s*사항|^(?:※\s*)?유의사항(?:\s*[:：]|\s*$)/i.test(t)) return true
  if (/^개요\s*[:：]|^여행\s*상품\s*개요|^상품\s*개요|^상품\s*소개\s*$/i.test(t)) return true
  if (/^꼭\s*확인|^포함\s*사항\s*$|^불포함\s*사항\s*$/i.test(t)) return true
  return false
}

/** 출도착 등에 속한 '출발/도착' 부분 문자열은 일정 큐로 치지 않는다. */
function hasModetourItineraryCueForSanitize(t: string): boolean {
  if (/(?:으로|로)\s*이동|예정\s*호텔|가이드\s*미팅|공항으로\s*이동|약\s*\d+\s*(?:시간|분)\s*소요|\([A-Z]{3}\)\s*(?:출발|도착)/i.test(t))
    return true
  if (/출도착/.test(t)) return false
  return /(?:이동|입국|출국|관광|방문|입장|체험|호텔|식사|예정\s*호텔|항공|미팅|집결|일차|편명|\d{1,2}\s*일차|\d{4}\s*[.\-/]\s*\d{1,2})/i.test(
    t
  ) || /(?:^|[\s,(])출발(?:[\s,)/:（]|$)/.test(t) || /(?:^|[\s,(])도착(?:[\s,)/:（]|$)/.test(t)
}

/** sanitize 단계에서 제거: 버튼·개요·유의 라벨·장문 홍보(일정 키워드 없음) */
function isModetourSanitizeDropLine(line: string): boolean {
  if (isNoiseLine(line)) return true
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (/^image$/i.test(t) || /^\[?이미지\]?\s*$/i.test(t)) return true
  if (/유의\s*[｜|Iil1ㅣ]\s*안내|유의\s*\|\s*안내/i.test(t)) return true
  if (/^개요\s*[:：]/i.test(t)) return true
  if (/^※\s*유의|^※\s*참고/i.test(t) && t.length < 80) return true
  if (/여행의 모든 일정은 유동적|임의로 변경될 수 있습니다|항공편 출도착 및 현지 교통사정/i.test(t)) return true
  if (/온라인 입국신고서를 의무적|중국에 입국하는 모든 외국인 관광객은/i.test(t)) return true
  if (/^#\S|선택옵션|선택관광명|미참여시|동행안함|쇼핑품목|환불가능$/i.test(t)) return true
  if (t.length > 140 && !hasModetourItineraryCueForSanitize(t)) return true
  return false
}

function isNoiseLine(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (NOISE_LINE.test(t)) return true
  if (t.length > 180 && !/[\uAC00-\uD7A3]/.test(t) && !/\s/.test(t)) return true
  if (t.length > 260) return true
  return false
}

/** 붙여넣기 본문에서 일정 추출용 가벼운 정리 (HTML 아님) */
function sanitizePastedBlobForSchedule(blob: string): string {
  return blob
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\t/g, ' ').trim())
    .filter((l) => l && !isModetourSanitizeDropLine(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

function dayHeaderOnLine(trimmed: string): { day: number; rest: string } | null {
  let m = /^DAY\s*0?(\d{1,2})(?!\d)/i.exec(trimmed)
  if (m?.[1]) {
    const day = Number(m[1])
    const rest = trimmed.slice(m[0].length).replace(/^[\s:：\-—.]+/, '').trim()
    if (day >= 1 && day <= 31) return { day, rest }
  }
  m = /^(\d{1,2})\s*일차\.?/i.exec(trimmed)
  if (m?.[1]) {
    const day = Number(m[1])
    const rest = trimmed.slice(m[0].length).replace(/^[\s:：\-—.]+/, '').trim()
    if (day >= 1 && day <= 31) return { day, rest }
  }
  return null
}

function isEmptyMealHotelField(v: string | null | undefined): boolean {
  const s = String(v ?? '').trim()
  return !s || s === '-' || s === '—' || s === '–'
}

function isModetourScheduleSectionStartLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (dayHeaderOnLine(t)) return true
  if (/^DAY\s*\d{1,2}\b/i.test(t)) return true
  if (/^(?:\d{1,2}\s*일차)/i.test(t)) return true
  if (/^예정\s*호텔(?:\s*[:：]?\s*$|\s*[:：]\s*\S)/i.test(t) || /^호텔\s*투숙/i.test(t)) return true
  if (/^식사\b/.test(t)) return true
  if (/^(?:관광|선택\s*관광|쇼핑|항공|미팅|집결)/.test(t)) return true
  return false
}

function isLikelyMealSubLine(line: string): boolean {
  const s = line.trim()
  return (
    /^(?:조식|아침|중식|점심|석식|저녁)\b/.test(s) ||
    /^\[?\s*(?:조식|아침|중식|점심|석식|저녁)\s*\]?/.test(s) ||
    /^[·▪•]\s*(?:조식|아침|중식|점심|석식|저녁)\b/.test(s)
  )
}

/** 예정호텔/식사 라벨과 값이 줄바꿈으로 떨어진 붙여넣기를 한 줄로 접는다. */
function foldModetourHotelMealLines(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i]!.trim()
    if (!L) continue

    if (/^예정\s*호텔\s*[:：]?\s*$/i.test(L)) {
      if (i + 1 < lines.length) {
        const next = lines[i + 1]!.trim()
        if (next && !isModetourScheduleSectionStartLine(next) && !isLikelyMealSubLine(next)) {
          out.push(`예정호텔: ${next}`)
          i++
          continue
        }
      }
      continue
    }

    const hotelLabel = L.match(/^(예정\s*호텔|호텔\s*투숙\s*(?:및\s*)?휴식)\s*[:：]?\s*(.*)$/i)
    if (hotelLabel) {
      const rest = (hotelLabel[2] ?? '').trim()
      if (rest) {
        out.push(`예정호텔: ${rest}`)
        continue
      }
      if (i + 1 < lines.length) {
        const next = lines[i + 1]!.trim()
        if (next && !isModetourScheduleSectionStartLine(next) && !isLikelyMealSubLine(next)) {
          out.push(`예정호텔: ${next}`)
          i++
          continue
        }
      }
      continue
    }

    const mealM = L.match(/^식사\s*[:：]?\s*(.*)$/i)
    if (mealM) {
      const rest = (mealM[1] ?? '').trim()
      if (rest) {
        out.push(`식사: ${rest}`)
        continue
      }
      const buf: string[] = []
      let j = i + 1
      while (j < lines.length && buf.length < 10) {
        const L2 = lines[j]!.trim()
        if (!L2) break
        if (isModetourScheduleSectionStartLine(L2) && !isLikelyMealSubLine(L2)) break
        if (isLikelyMealSubLine(L2) || /^(?:조식|아침|중식|점심|석식|저녁)\s*[-–—:：]/.test(L2)) {
          buf.push(L2)
          j++
          continue
        }
        break
      }
      if (buf.length) {
        out.push(`식사: ${buf.join(' ')}`)
        i = j - 1
      }
      continue
    }

    out.push(L)
  }
  return out
}

/** 일정표 본문에서 추출한 예정호텔이 있으면 LLM/호텔 입력란 hotelText보다 우선한다. */
function applyModetourBodyHotelTextWins(
  row: RegisterScheduleDay,
  bodyRow: RegisterScheduleDay | undefined
): RegisterScheduleDay {
  if (!bodyRow) return row
  const h = bodyRow.hotelText?.trim()
  if (!h || isEmptyMealHotelField(h)) return row
  return { ...row, hotelText: h.slice(0, 500) }
}

function mergeScheduleMealHotelPatch(
  base: RegisterScheduleDay,
  patch: Partial<RegisterScheduleDay>
): RegisterScheduleDay {
  const out = { ...base }
  const keys: (keyof RegisterScheduleDay)[] = [
    'hotelText',
    'breakfastText',
    'lunchText',
    'dinnerText',
    'mealSummaryText',
  ]
  for (const k of keys) {
    const pv = patch[k]
    if (pv == null || typeof pv !== 'string') continue
    const p = pv.trim()
    if (!p) continue
    if (!isEmptyMealHotelField(out[k] as string | null | undefined)) continue
    ;(out as Record<string, unknown>)[k] = p
  }
  return out
}

/** 본문 일정표 추출값이 있으면 `-`/빈 기존값을 덮어쓴다. */
function mergeModetourMealHotelPreferWeakBody(
  base: RegisterScheduleDay,
  body: Partial<RegisterScheduleDay>
): RegisterScheduleDay {
  const out = { ...base }
  const keys: (keyof RegisterScheduleDay)[] = [
    'hotelText',
    'breakfastText',
    'lunchText',
    'dinnerText',
    'mealSummaryText',
  ]
  for (const k of keys) {
    const bv = body[k]
    if (bv == null || typeof bv !== 'string') continue
    const bt = bv.trim()
    if (!bt || isEmptyMealHotelField(bt)) continue
    if (isEmptyMealHotelField(out[k] as string | null | undefined)) {
      ;(out as Record<string, unknown>)[k] = k === 'hotelText' ? bt.slice(0, 500) : bt.slice(0, 500)
    }
  }
  return out
}

function extractMealHotelFromBlock(text: string): Partial<RegisterScheduleDay> {
  const rawLines = text.replace(/\r/g, '\n').split('\n').map((l) => l.replace(/\s+/g, ' ').trim())
  const folded = foldModetourHotelMealLines(rawLines.filter(Boolean))
  const t = folded.join('\n')

  const out: Partial<RegisterScheduleDay> = {}
  // 모두투어 흔한 형태: "조식 - 호텔식, 중식 - 현지식, 석식 - 현지식" (쉼표 구분 — 슬래시 없음)
  const commaTrip = t.match(
    /(?:조식|아침)\s*[-–—:：]\s*([^,，\n]+?)\s*[,，]\s*(?:중식|점심)\s*[-–—:：]\s*([^,，\n]+?)\s*[,，]\s*(?:석식|저녁)\s*[-–—:：]\s*([^\n]+)/i
  )
  if (commaTrip) {
    if (commaTrip[1]?.trim()) out.breakfastText = normalizeModetourMealCapture(commaTrip[1]).slice(0, 200)
    if (commaTrip[2]?.trim()) out.lunchText = normalizeModetourMealCapture(commaTrip[2]).slice(0, 200)
    if (commaTrip[3]?.trim()) out.dinnerText = normalizeModetourMealCapture(commaTrip[3]).slice(0, 200)
  }
  // `/` `·` `｜` 등 슬래시형
  const triplet =
    out.breakfastText && out.lunchText && out.dinnerText
      ? null
      : t.match(
          /(?:조식|아침)\s*[-:：/／·｜ㅣ]\s*([^/|｜ㅣ·\n]+?)\s*[-/／·｜ㅣ]\s*(?:중식|점심)\s*[-:：/／·｜ㅣ]?\s*([^/|｜ㅣ·\n]+?)\s*[-/／·｜ㅣ]\s*(?:석식|저녁)\s*[-:：/／·｜ㅣ]?\s*([^/|｜ㅣ·\n]+)/i
        )
  if (triplet) {
    if (triplet[1]?.trim()) out.breakfastText = normalizeModetourMealCapture(triplet[1]).slice(0, 200)
    if (triplet[2]?.trim()) out.lunchText = normalizeModetourMealCapture(triplet[2]).slice(0, 200)
    if (triplet[3]?.trim()) out.dinnerText = normalizeModetourMealCapture(triplet[3]).slice(0, 200)
  }
  if (!out.breakfastText) {
    const bp =
      t.match(/(?:조식|아침)\s*[-:：–—/／·｜ㅣ]\s*([^\n/|｜ㅣ·]+?)(?=\s*(?:[,，]|[/|／·｜ㅣ]|\n|$|중식|점심))/i) ||
      t.match(/\[?\s*(?:조식|아침)\s*\]?\s*[:：]?\s*([^\n[/]+?)(?=\s*(?:\n|$|\[?\s*(?:중식|점심)))/i)
    if (bp?.[1]?.trim()) out.breakfastText = normalizeModetourMealCapture(bp[1]).slice(0, 200)
  }
  if (!out.lunchText) {
    const lp =
      t.match(/(?:중식|점심)\s*[-:：–—/／·｜ㅣ]\s*([^\n/|｜ㅣ·]+?)(?=\s*(?:[,，]|[/|／·｜ㅣ]|\n|$|석식|저녁))/i) ||
      t.match(/\[?\s*(?:중식|점심)\s*\]?\s*[:：]?\s*([^\n[/]+?)(?=\s*(?:\n|$|\[?\s*(?:석식|저녁)))/i)
    if (lp?.[1]?.trim()) out.lunchText = normalizeModetourMealCapture(lp[1]).slice(0, 200)
  }
  if (!out.dinnerText) {
    const dp =
      t.match(/(?:석식|저녁)\s*[-:：–—/／·｜ㅣ]\s*([^\n]+)/i) ||
      t.match(/\[?\s*(?:석식|저녁)\s*\]?\s*[:：]?\s*([^\n]+)/i)
    if (dp?.[1]?.trim()) out.dinnerText = normalizeModetourMealCapture(dp[1]).slice(0, 200)
  }

  const hpPrimary = t.match(/(?:예정\s*호텔|호텔\s*투숙\s*(?:및\s*)?휴식)\s*[:：]?\s*([^\n]+)/i)
  if (hpPrimary?.[1]?.trim()) {
    const hv = hpPrimary[1].trim()
    if (!/^예정\s*호텔$/i.test(hv)) out.hotelText = hv.slice(0, 500)
  }
  else {
    const hpAlt = t.match(/예정숙소\s*[:：]?\s*([^\n]+)/i)
    if (hpAlt?.[1]?.trim()) out.hotelText = hpAlt[1].trim().slice(0, 500)
  }

  if (!out.breakfastText && !out.lunchText && !out.dinnerText) {
    const mealOnly = t.match(/식사\s*[:：]\s*([^\n]+)/i) || t.match(/식사\s+(?![:：])([^\n]+)/i)
    if (mealOnly?.[1]?.trim()) out.mealSummaryText = normalizeModetourMealCapture(mealOnly[1]).slice(0, 500)
  } else {
    const parts = [
      out.breakfastText ? `조식 - ${out.breakfastText}` : '',
      out.lunchText ? `중식 - ${out.lunchText}` : '',
      out.dinnerText ? `석식 - ${out.dinnerText}` : '',
    ].filter(Boolean)
    if (parts.length && !out.mealSummaryText) out.mealSummaryText = parts.join(', ').slice(0, 500)
  }

  if (out.breakfastText) out.breakfastText = normalizeModetourMealCapture(out.breakfastText)
  if (out.lunchText) out.lunchText = normalizeModetourMealCapture(out.lunchText)
  if (out.dinnerText) out.dinnerText = normalizeModetourMealCapture(out.dinnerText)
  if (out.mealSummaryText) out.mealSummaryText = normalizeModetourMealCapture(out.mealSummaryText)

  return out
}

function normalizeModetourMealCapture(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/일자\s*$/i, '')
    .replace(/[,，]\s*[,，]+/g, ', ')
    .replace(/^[,，\s]+|[,，\s]+$/g, '')
    .trim()
}

/** 유의/개요/더보기 구간: 장문만 건너뛰고 같은 일차의 이동·호텔·식사 줄은 다시 받는다. */
function isModetourCoreItineraryResumeLine(t: string): boolean {
  const L = t.replace(/\s+/g, ' ').trim()
  if (!L || L.length > 130) return false
  if (/^예정\s*호텔/i.test(L) || /^식사\s*[:：]|^호텔\s*투숙/i.test(L)) return true
  if (/(?:로|으로)\s*이동|공항으로\s*이동|약\s*\d+\s*(?:시간|분)\s*소요/i.test(L)) return true
  if (/^가이드\s*미팅|^인천\s*\(|^연길\s*\(/i.test(L)) return true
  if (/^백두산\s*서파(?:로)?$/i.test(L) || /^백두산\s*북파(?:로)?$/i.test(L)) return true
  if (/국제공항\s*(?:출발|도착)/.test(L)) return true
  if (/\([A-Z]{3}\)\s*(?:출발|도착)/i.test(L)) return true
  return false
}

function splitLinesIntoDayBlocks(sanitized: string): Array<{ day: number; lines: string[] }> {
  const rawLines = sanitized.split('\n')
  const blocks: Array<{ day: number; lines: string[] }> = []
  let cur: { day: number; lines: string[] } | null = null
  let skipVerbose = false

  for (const line of rawLines) {
    const t = line.trim()
    if (isModetourScheduleTailBreakLine(t)) {
      skipVerbose = true
      continue
    }
    const h = dayHeaderOnLine(t)
    if (h) {
      skipVerbose = false
      if (cur && cur.lines.some((x) => x.replace(/\s/g, '').length > 0)) blocks.push(cur)
      cur = { day: h.day, lines: [] }
      if (h.rest && !isNoiseLine(h.rest)) cur.lines.push(h.rest)
      continue
    }
    if (!cur) continue
    if (skipVerbose) {
      if (isModetourCoreItineraryResumeLine(t)) {
        skipVerbose = false
        if (!isNoiseLine(line)) cur.lines.push(line)
      }
      continue
    }
    if (!isNoiseLine(line)) cur.lines.push(line)
  }
  if (cur && cur.lines.some((x) => x.replace(/\s/g, '').length > 0)) blocks.push(cur)
  return blocks
}

function isLineExcludedFromBrief(line: string): boolean {
  const L = line.replace(/\s+/g, ' ').trim()
  if (!L) return true
  if (/^(?:식사|예정\s*호텔|호텔\s*투숙)/i.test(L)) return true
  if (/선택\s*관광|옵션\s*투어|유의사항|개요\s*[:：]|더보기|크게\s*보기|^image$/i.test(L)) return true
  if (/여행의 모든 일정은 유동적|임의로 변경|항공편 출도착|온라인 입국|의무적\s*작성|양해부탁|별도\s*입장료|환경보호\s*셔틀|^\s*※|^\s*◎/.test(L))
    return true
  if (/출도착/.test(L) && !/\([A-Z]{3}\)\s*(?:출발|도착)/.test(L)) return true
  if (/입국신고서|QR코드|90일\s*이내|nia\.gov\.cn/i.test(L)) return true
  if (/▶|■\s*중국|무비자\s*입국\s*시행|제출\s*방법|사전\s*입국|작성\s*요령/i.test(L)) return true
  if (/QR\s*코드|필수\)|입국\s*심사시|대답해\s*주시면|필요시\s*제출|입국\s*도시\s*\(/i.test(L)) return true
  if (/해발고도|야생화|구릉지대|계단이\s*\d+개|㎡|㎢/i.test(L)) return true
  if (/경계비가\s*세워져|내려다\s*볼\s*수\s*있는\s*곳으로/i.test(L)) return true
  if (/^#\S|선택옵션|동행안함\$?\d/i.test(L)) return true
  return false
}

function lineHasBriefItineraryCue(L: string): boolean {
  if (/출도착/.test(L)) return false
  const bdSapa =
    /(?:^|\s)백두산\s*서파(?:로)?(?:\s*이동|\s*$)/.test(L) || /^백두산\s*서파(?:로)?$/i.test(L.trim())
  const bdBuk =
    /(?:^|\s)백두산\s*북파(?:로)?(?:\s*이동|\s*산문|\s*\(|약\s*\d+\s*시간|\s*$)/.test(L) ||
    /^백두산\s*북파(?:로)?$/i.test(L.trim())
  return (
    /(?:으로|로)\s*이동|공항으로\s*이동|약\s*\d+\s*(?:시간|분)\s*소요|가이드\s*미팅/.test(L) ||
    bdSapa ||
    bdBuk ||
    /국제공항\s*(?:출발|도착)/.test(L) ||
    /\([A-Z]{3}\)\s*(?:출발|도착)/.test(L) ||
    /(?:^|[\s,(])출발(?:[\s,)/:（]|$)/.test(L) ||
    /(?:^|[\s,(])도착(?:[\s,)/:（]|$)/.test(L) ||
    /(?:입국|출국|방문|입장|체험|미팅|집결)/.test(L)
  )
}

/** `약 N시간 소요` 등 본문에 적힌 이동 시간(시 단위) */
function extractModetourHoursNear(blob: string, anchor: RegExp): string | null {
  const i = blob.search(anchor)
  if (i < 0) return null
  const win = blob.slice(Math.max(0, i - 80), i + 120)
  const m = win.match(/약\s*(\d+)\s*시간/)
  return m?.[1] ?? null
}

/**
 * 일차별 핵심 패턴이 잡히면 짧은 title + 1문장 description으로 마감.
 * 패턴 불일치 시에만 기존 브리프 조합(폴백) 사용.
 */
function finalizeModetourTitleAndDescription(useful: string[]): { title: string; description: string } {
  const blob = useful.join('\n')

  if (/연길\s*\(\s*YNJ\s*\)\s*출발/.test(blob) && /인천\s*\(\s*ICN\s*\)\s*도착/.test(blob)) {
    return {
      title: '연길 출발 · 인천 도착',
      description: '연길에서 출발해 인천으로 귀국하는 일정입니다.',
    }
  }

  if (/호텔\s*조식\s*후\s*백두산\s*북파/.test(blob) && /연길로\s*이동/.test(blob)) {
    const hLong = extractModetourHoursNear(blob, /연길로\s*이동/)
    const desc =
      hLong != null
        ? `호텔 조식 후 백두산 북파를 관광하고 약 ${hLong}시간 이동해 연길로 이동하는 일정입니다.`
        : '호텔 조식 후 백두산 북파를 관광하고 연길로 이동하는 일정입니다.'
    return { title: '백두산 북파 관광 후 연길 이동', description: desc }
  }

  if (/호텔\s*조식\s*후\s*백두산\s*서파/.test(blob) && /이도백하로\s*이동/.test(blob)) {
    const h = extractModetourHoursNear(blob, /이도백하로\s*이동/)
    const desc =
      h != null
        ? `호텔 조식 후 백두산 서파 핵심 일정을 둘러보고 약 ${h}시간 이동해 이도백하로 이동하는 일정입니다.`
        : '호텔 조식 후 백두산 서파 핵심 일정을 둘러본 뒤 이도백하로 이동하는 일정입니다.'
    return { title: '백두산 서파 관광 후 이도백하 이동', description: desc }
  }

  if (/인천\s*\(\s*ICN\s*\)\s*출발/.test(blob) && /연길\s*\(\s*YNJ\s*\)\s*도착/.test(blob)) {
    const h = extractModetourHoursNear(blob, /이도백하로\s*이동/)
    const desc =
      h != null
        ? `인천에서 출발해 연길에 도착한 뒤 약 ${h}시간 이동해 이도백하로 이동하는 일정입니다.`
        : '인천에서 출발해 연길에 도착하는 일정입니다.'
    return { title: '인천 출발 · 연길 도착', description: desc }
  }

  return {
    title: buildBriefModetourTitleFallback(useful),
    description: buildBriefModetourDescriptionFallback(useful),
  }
}

function stripModetourAirportParen(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/인천\s*\(\s*ICN\s*\)/gi, '인천')
    .replace(/연길\s*\(\s*YNJ\s*\)/gi, '연길')
    .trim()
}

/** 패턴 미매칭 일차용 짧은 title (최대 길이 보수적). */
function buildBriefModetourTitleFallback(useful: string[]): string {
  const flow: string[] = []
  for (const raw of useful) {
    const L = raw.replace(/\s+/g, ' ').trim()
    if (!L || isLineExcludedFromBrief(L)) continue
    if (L.length > 90) continue
    if (lineHasBriefItineraryCue(L)) flow.push(L)
  }
  if (!flow.length) {
    const head = useful
      .map((u) => u.replace(/\s+/g, ' ').trim())
      .find((u) => u && !isLineExcludedFromBrief(u) && u.length <= 56 && lineHasBriefItineraryCue(u))
    if (head) return head.replace(/\s+/g, ' ').trim().slice(0, 48)
    const fallback = useful.map((u) => u.replace(/\s+/g, ' ').trim()).find((u) => u && !isLineExcludedFromBrief(u) && u.length <= 56)
    return (fallback ?? useful[0] ?? '').replace(/\s+/g, ' ').trim().slice(0, 48)
  }
  const parenFlight = flow.filter((x) => /\([A-Z]{3}\)\s*(?:출발|도착)/.test(x))
  if (parenFlight.length >= 2) {
    const a = stripModetourAirportParen(parenFlight[0]!)
    const b = stripModetourAirportParen(parenFlight[1]!)
    return `${a} · ${b}`.replace(/\s+/g, ' ').trim().slice(0, 48)
  }
  const airportish = flow.every((x) => /공항|\([A-Z]{3}\)|출발|도착/.test(x))
  const pick = airportish && flow.length > 2 ? flow.slice(0, 2) : flow.slice(0, 3)
  return pick.join(' ').replace(/\s+/g, ' ').trim().slice(0, 48)
}

/** 패턴 미매칭 일차용 1문장 브리프(종결 어미). */
function buildBriefModetourDescriptionFallback(useful: string[]): string {
  const parts: string[] = []
  for (const raw of useful) {
    const L = raw.replace(/\s+/g, ' ').trim()
    if (!L || isLineExcludedFromBrief(L)) continue
    if (L.length > 130) continue
    if (lineHasBriefItineraryCue(L) || /호텔\s*조식\s*후|편명/.test(L)) parts.push(L)
  }
  const parenFlightParts = parts.filter((x) => /\([A-Z]{3}\)\s*(?:출발|도착)/.test(x))
  let segs =
    parenFlightParts.length >= 2 ? parenFlightParts.slice(0, 2) : parts.slice(0, 3)
  segs = segs.slice(0, 3)
  const deduped: string[] = []
  for (const p of segs) {
    const x = p.trim()
    if (deduped.length && deduped[deduped.length - 1] === x) continue
    deduped.push(x)
  }
  let text = deduped.join(' ').replace(/\s+/g, ' ').trim()
  if (!text) {
    for (const raw of useful) {
      const L = raw.replace(/\s+/g, ' ').trim()
      if (!L || isLineExcludedFromBrief(L) || L.length > 100) continue
      if (!lineHasBriefItineraryCue(L) && !/호텔\s*조식\s*후/.test(L)) continue
      text = L
      break
    }
  }
  if (!text) return ''
  if (/[.!?。…]$/.test(text)) return text.slice(0, 160).trim()
  if (/\([A-Z]{3}\)\s*출발/.test(text) && /\([A-Z]{3}\)\s*도착/.test(text)) {
    const a = text.replace(/\s*\(\s*ICN\s*\)\s*/gi, ' ').replace(/\s*\(\s*YNJ\s*\)\s*/gi, ' ')
    if (/인천.*출발.*연길.*도착/i.test(a))
      return '인천에서 출발해 연길에 도착하는 일정입니다.'.slice(0, 160)
    if (/연길.*출발.*인천.*도착/i.test(a))
      return '연길에서 출발해 인천으로 귀국하는 일정입니다.'.slice(0, 160)
  }
  return `${text.slice(0, 120).trim()}하는 일정입니다.`
}

function blockToScheduleDay(day: number, lines: string[]): RegisterScheduleDay {
  const useful = lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const blob = useful.join('\n')
  const meal = extractMealHotelFromBlock(blob)
  const { title, description } = finalizeModetourTitleAndDescription(useful)
  const imageKeyword = modetourScheduleImageKeywordFallback(day)
  return {
    day,
    title,
    description,
    imageKeyword,
    ...meal,
  }
}

/**
 * 동일 일차 블록 여러 개면 줄 병합.
 * 붙여넣기 하단의 '호텔 요약표' 등에서 같은 N일차 헤더가 반복되면 본문 일정 뒤에 표가 이어 붙는다 → 첫 블록만 채택.
 */
function mergeBlocksByDay(blocks: Array<{ day: number; lines: string[] }>): Map<number, string[]> {
  const m = new Map<number, string[]>()
  const seenDay = new Set<number>()
  for (const b of blocks) {
    if (seenDay.has(b.day)) continue
    seenDay.add(b.day)
    m.set(b.day, [...b.lines])
  }
  return m
}

/** 일차 원문 blob(식사/숙소 재추출·키워드용) — title/description 정제와 무관하게 동일 분리 규칙 적용 */
function getModetourPastedDayBlobMap(rawText: string): Map<number, string> {
  const sanitized = sanitizePastedBlobForSchedule(rawText)
  if (!sanitized.trim()) return new Map()
  const blocks = splitLinesIntoDayBlocks(sanitized)
  if (!blocks.length) return new Map()
  const byDay = mergeBlocksByDay(blocks)
  const m = new Map<number, string>()
  for (const d of byDay.keys()) {
    const lines = byDay.get(d) ?? []
    m.set(d, lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'))
  }
  return m
}

function applyModetourScheduleRowBlobFinale(
  row: RegisterScheduleDay,
  blob: string,
  bodyRow: RegisterScheduleDay | undefined
): RegisterScheduleDay {
  const ex = blob.trim() ? extractMealHotelFromBlock(blob) : {}
  let next = mergeModetourMealHotelPreferWeakBody(row, { ...row, ...ex })
  if (bodyRow) {
    next = mergeModetourMealHotelPreferWeakBody(next, bodyRow)
    next = applyModetourBodyHotelTextWins(next, bodyRow)
    const bik = bodyRow.imageKeyword?.trim() ?? ''
    if (bik && !isDayNTravelKeyword(bik)) next = { ...next, imageKeyword: bik }
  } else if (ex.hotelText?.trim() && !isEmptyMealHotelField(ex.hotelText)) {
    next = applyModetourBodyHotelTextWins(next, {
      day: row.day,
      title: '',
      description: '',
      imageKeyword: '',
      ...ex,
    } as RegisterScheduleDay)
  }
  if (!next.imageKeyword?.trim()) {
    next = {
      ...next,
      imageKeyword: modetourScheduleImageKeywordFallback(next.day),
    }
  }
  return next
}

export function buildModetourScheduleFromPastedText(rawText: string): RegisterScheduleDay[] {
  const sanitized = sanitizePastedBlobForSchedule(rawText)
  if (!sanitized.trim()) return []
  const blocks = splitLinesIntoDayBlocks(sanitized)
  if (!blocks.length) return []
  const byDay = mergeBlocksByDay(blocks)
  const days = [...byDay.keys()].sort((a, b) => a - b)
  return days.map((d) => blockToScheduleDay(d, byDay.get(d) ?? []))
}

function rowIsWeak(r: RegisterScheduleDay): boolean {
  const t = (r.title ?? '').trim()
  const d = (r.description ?? '').trim()
  const k = (r.imageKeyword ?? '').trim()
  if (isDayNTravelKeyword(k)) return true
  if (t.length < 4 && d.length < 16) return true
  return false
}

function scheduleNeedsBodyBoost(schedule: RegisterScheduleDay[]): boolean {
  if (!schedule.length) return true
  return schedule.some(rowIsWeak)
}

function mergeWeakWithBody(
  llm: RegisterScheduleDay,
  body: RegisterScheduleDay,
  dayBlob: string
): RegisterScheduleDay {
  const t = llm.title.trim()
  const d = llm.description.trim()
  const k = llm.imageKeyword.trim()
  let next: RegisterScheduleDay = { ...llm }
  if (t.length < 4) next.title = body.title
  if (d.length < 16) next.description = body.description
  if (!k || isDayNTravelKeyword(k)) next.imageKeyword = body.imageKeyword
  if (dayBlob.trim()) {
    const ex = extractMealHotelFromBlock(dayBlob)
    next = mergeModetourMealHotelPreferWeakBody(next, { ...next, ...ex })
  }
  next = mergeModetourMealHotelPreferWeakBody(next, body)
  next = mergeScheduleMealHotelPatch(next, body)
  next = applyModetourBodyHotelTextWins(next, body)
  if (!next.imageKeyword?.trim()) {
    next = {
      ...next,
      imageKeyword: modetourScheduleImageKeywordFallback(next.day),
    }
  }
  return next
}

/**
 * parseForRegister 직후: schedule 비었거나 빈약하면 붙여넣기 본문으로 보강(식사·숙소 등). imageKeyword는 LLM 값 우선.
 */
export function supplementModetourScheduleFromPastedBody(
  parsed: RegisterParsed,
  pastedRawText: string
): RegisterParsed {
  const trimmed = pastedRawText?.trim() ?? ''
  if (!trimmed) return parsed

  const blobByDay = getModetourPastedDayBlobMap(trimmed)
  let schedule = [...(parsed.schedule ?? [])]

  /**
   * 선추출 LLM이 이미 schedule 요약을 채운 경우, `rowIsWeak`만 보고 `mergeWeakWithBody`(본문 정규식)로
   * title/description을 덮어쓰면 미리보기 문구가 선추출 전과 한 글자도 달라지지 않은 것처럼 보인다.
   */
  const preserveExtractCopy = parsed.modetourScheduleExtractFilled === true
  const needBodyBoost = !preserveExtractCopy && scheduleNeedsBodyBoost(schedule)

  if (!needBodyBoost) {
    const needKeywordFix = schedule.some((r) => isDayNTravelKeyword(r.imageKeyword))
    const fromBodyFast = buildModetourScheduleFromPastedText(trimmed)
    const bodyByDayFast = new Map(fromBodyFast.map((r) => [r.day, r]))
    if (!needKeywordFix && !fromBodyFast.length) return parsed
    schedule = schedule.map((r) => {
      const b = bodyByDayFast.get(r.day)
      const blob = blobByDay.get(r.day) ?? ''
      let next = { ...r }
      if (needKeywordFix && isDayNTravelKeyword(r.imageKeyword) && b && !preserveExtractCopy) {
        next = mergeWeakWithBody(r, b, blob)
      } else {
        if (b) {
          if (blob.trim()) {
            next = mergeModetourMealHotelPreferWeakBody(next, {
              ...next,
              ...extractMealHotelFromBlock(blob),
            })
          }
          next = mergeModetourMealHotelPreferWeakBody(next, b)
          next = mergeScheduleMealHotelPatch(next, b)
          next = applyModetourBodyHotelTextWins(next, b)
        } else if (blob.trim()) {
          next = mergeModetourMealHotelPreferWeakBody(next, {
            ...next,
            ...extractMealHotelFromBlock(blob),
          })
        }
        if (needKeywordFix && isDayNTravelKeyword(next.imageKeyword)) {
          next = {
            ...next,
            imageKeyword: modetourScheduleImageKeywordFallback(r.day),
          }
        }
      }
      return applyModetourScheduleRowBlobFinale(next, blob, b)
    })
    return { ...parsed, schedule }
  }

  const fromBody = buildModetourScheduleFromPastedText(trimmed)
  const bodyByDay = new Map(fromBody.map((r) => [r.day, r]))

  if (!fromBody.length) {
    schedule = schedule.map((r) => {
      const blob = blobByDay.get(r.day) ?? ''
      let next = { ...r }
      if (blob.trim()) {
        next = mergeModetourMealHotelPreferWeakBody(next, {
          ...next,
          ...extractMealHotelFromBlock(blob),
        })
      }
      return applyModetourScheduleRowBlobFinale(next, blob, undefined)
    })
    return { ...parsed, schedule }
  }

  if (!schedule.length) {
    const out = fromBody.map((r) =>
      applyModetourScheduleRowBlobFinale(r, blobByDay.get(r.day) ?? '', r)
    )
    return { ...parsed, schedule: out }
  }

  const llmByDay = new Map(schedule.map((r) => [r.day, r]))
  const allDays = [...new Set([...llmByDay.keys(), ...bodyByDay.keys()])].sort((a, b) => a - b)
  const merged: RegisterScheduleDay[] = []
  for (const day of allDays) {
    const llm = llmByDay.get(day)
    const body = bodyByDay.get(day)
    const blob = blobByDay.get(day) ?? ''
    if (!llm && body) {
      merged.push(applyModetourScheduleRowBlobFinale(body, blob, body))
      continue
    }
    if (llm && !body) {
      let row = llm
      if (blob.trim()) {
        row = mergeModetourMealHotelPreferWeakBody(row, {
          ...row,
          ...extractMealHotelFromBlock(blob),
        })
      }
      merged.push(applyModetourScheduleRowBlobFinale(row, blob, undefined))
      continue
    }
    if (llm && body) {
      let row: RegisterScheduleDay
      if (rowIsWeak(llm)) {
        row = mergeWeakWithBody(llm, body, blob)
      } else {
        row = { ...llm }
        if (isDayNTravelKeyword(llm.imageKeyword)) {
          row = {
            ...row,
            imageKeyword:
              body.imageKeyword && !isDayNTravelKeyword(body.imageKeyword)
                ? body.imageKeyword
                : modetourScheduleImageKeywordFallback(day),
          }
        }
        if (blob.trim()) {
          row = mergeModetourMealHotelPreferWeakBody(row, {
            ...row,
            ...extractMealHotelFromBlock(blob),
          })
        }
        row = mergeModetourMealHotelPreferWeakBody(row, body)
        row = mergeScheduleMealHotelPatch(row, body)
        row = applyModetourBodyHotelTextWins(row, body)
      }
      merged.push(applyModetourScheduleRowBlobFinale(row, blob, body))
    }
  }

  return { ...parsed, schedule: merged }
}
