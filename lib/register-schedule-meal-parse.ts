/**
 * 등록 일정 — 조식·중식·석식 본문 파싱 SSOT (6공급사 공통).
 *
 * REGRESSION-FREEZE[register-schedule-meal-parse]: bracket·comma·slash 식사 파싱 — manifest
 */
import { isEmptyMealHotelField } from '@/lib/register-schedule-meal-hotel-merge'

export type ParsedScheduleMealFields = {
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
}

export function normalizeScheduleMealCapture(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/일자\s*$/i, '')
    .replace(/[,，]\s*[,，]+/g, ', ')
    .replace(/^[,，\s]+|[,，\s]+$/g, '')
    .trim()
}

/**
 * 식사 **시간대(슬롯)** 접두(조식·중식·석식)만 제거하고 **식사 내용**(기내식·현지식·호텔식 등)만 남긴다.
 * 조식/중식/석식은 식사 종류가 아니라 아침·점심·저녁 슬롯 표기다.
 * @example `석식 현지식` → `현지식`
 */
export function stripMealTypeLabelPrefix(text: string | null | undefined): string | null {
  const t = String(text ?? '').trim()
  if (!t) return null
  const stripped = t.replace(/^(?:조식|아침|중식|점심|석식|저녁)\s*[-–—:：]?\s*/i, '').trim()
  return stripped || t
}

const MEAL_SLOT_KEYS = ['breakfastText', 'lunchText', 'dinnerText'] as const
type MealSlotKey = (typeof MEAL_SLOT_KEYS)[number]

function mealSlotKeyFromLabel(text: string): MealSlotKey | null {
  if (/^(?:조식|아침)/i.test(text)) return 'breakfastText'
  if (/^(?:중식|점심)/i.test(text)) return 'lunchText'
  if (/^(?:석식|저녁)/i.test(text)) return 'dinnerText'
  return null
}

function nextEmptyMealSlot(out: ParsedScheduleMealFields): MealSlotKey | null {
  return MEAL_SLOT_KEYS.find((k) => isEmptyMealHotelField(out[k])) ?? null
}

/**
 * 하나투어 itnr fact `meals[]` — 슬롯 표기(조·중·석)와 식사 내용(기내식 등)이 카드별로 올 때 매핑.
 * 슬롯 접두가 없는 항목은 빈 칸에 순서대로 채우되, 석식이 이미 있으면 남은 1건은 중식 칸 우선.
 */
export function parseFactMealsListToScheduleFields(meals: string[]): ParsedScheduleMealFields {
  const out: ParsedScheduleMealFields = {}
  const unattributed: string[] = []

  for (const raw of meals) {
    const t = String(raw ?? '').trim()
    if (!t || isEmptyMealHotelField(t)) continue
    const slot = mealSlotKeyFromLabel(t)
    if (slot) {
      assignMealField(out, slot, stripMealTypeLabelPrefix(t))
    } else {
      unattributed.push(t)
    }
  }

  for (const content of unattributed) {
    let slot = nextEmptyMealSlot(out)
    if (
      unattributed.length === 1 &&
      out.dinnerText &&
      isEmptyMealHotelField(out.lunchText) &&
      isEmptyMealHotelField(out.breakfastText)
    ) {
      slot = 'lunchText'
    }
    if (!slot) break
    assignMealField(out, slot, content)
  }

  if (meals.length > 0) {
    out.mealSummaryText = meals
      .map((m) => String(m ?? '').trim())
      .filter(Boolean)
      .join(' / ')
      .slice(0, 500)
  }
  return out
}

function assignMealField(
  out: ParsedScheduleMealFields,
  key: 'breakfastText' | 'lunchText' | 'dinnerText',
  raw: string | null | undefined,
): void {
  const v = normalizeScheduleMealCapture(String(raw ?? ''))
  if (!v || isEmptyMealHotelField(v)) return
  out[key] = v.slice(0, 200)
}

function buildMealSummary(out: ParsedScheduleMealFields): void {
  const parts = [
    out.breakfastText ? `조식 - ${out.breakfastText}` : '',
    out.lunchText ? `중식 - ${out.lunchText}` : '',
    out.dinnerText ? `석식 - ${out.dinnerText}` : '',
  ].filter(Boolean)
  if (parts.length) out.mealSummaryText = parts.join(', ').slice(0, 500)
}

/**
 * 식사 한 덩어리 텍스트 → 조·중·석 필드.
 * `[조식]없음 [중식]없음 [석식]리조트식` · `조식 호텔식, 중식 현지식, 석식 한식` 등.
 */
export function parseScheduleMealFieldsFromText(raw: string | null | undefined): ParsedScheduleMealFields {
  const folded = String(raw ?? '')
    .replace(/\r/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!folded) return {}

  const out: ParsedScheduleMealFields = {}

  const bracketTriple = folded.match(
    /\[조식\]\s*([\s\S]*?)\s*\[중식\]\s*([\s\S]*?)\s*\[석식\]\s*([\s\S]+?)(?=\s*(?:\[TIP\]|예정\s*호텔|숙박|호텔\s*투숙|\d{1,2}일차|$))/i,
  )
  if (bracketTriple) {
    assignMealField(out, 'breakfastText', bracketTriple[1])
    assignMealField(out, 'lunchText', bracketTriple[2])
    assignMealField(out, 'dinnerText', bracketTriple[3])
    buildMealSummary(out)
    return out
  }

  const commaDash = folded.match(
    /(?:조식|아침)\s*[-–—:：]\s*([^,，]+?)\s*[,，]\s*(?:중식|점심)\s*[-–—:：]\s*([^,，]+?)\s*[,，]\s*(?:석식|저녁)\s*[-–—:：]\s*(.+)/i,
  )
  if (commaDash) {
    assignMealField(out, 'breakfastText', commaDash[1])
    assignMealField(out, 'lunchText', commaDash[2])
    assignMealField(out, 'dinnerText', commaDash[3])
    buildMealSummary(out)
    return out
  }

  const commaSpace = folded.match(
    /(?:조식|아침)\s+([^,，]+?)\s*[,，]\s*(?:중식|점심)\s+([^,，]+?)\s*[,，]\s*(?:석식|저녁)\s+(.+)/i,
  )
  if (commaSpace) {
    assignMealField(out, 'breakfastText', commaSpace[1])
    assignMealField(out, 'lunchText', commaSpace[2])
    assignMealField(out, 'dinnerText', commaSpace[3])
    buildMealSummary(out)
    return out
  }

  const slashTriple = folded.match(
    /(?:조식|아침)\s*[-:：/／·｜]?\s*([^/|｜·\n]+?)\s*[/／·｜]\s*(?:중식|점심)\s*[-:：/／·｜]?\s*([^/|｜·\n]+?)\s*[/／·｜]\s*(?:석식|저녁)\s*[-:：/／·｜]?\s*([^/|｜·\n]+)/i,
  )
  if (slashTriple) {
    assignMealField(out, 'breakfastText', slashTriple[1])
    assignMealField(out, 'lunchText', slashTriple[2])
    assignMealField(out, 'dinnerText', slashTriple[3])
    buildMealSummary(out)
    return out
  }

  if (!out.breakfastText) {
    const bp =
      folded.match(/(?:조식|아침)\s*[-:：–—]\s*([^\n/|｜,，]+?)(?=\s*(?:[,，]|[/|／·｜]|\n|$|중식|점심))/i) ||
      folded.match(/\[?\s*(?:조식|아침)\s*\]?\s*[:：]?\s*([^\n[/\[]+?)(?=\s*(?:\n|$|\[?\s*(?:중식|점심)))/i)
    assignMealField(out, 'breakfastText', bp?.[1])
  }
  if (!out.lunchText) {
    const lp =
      folded.match(/(?:중식|점심)\s*[-:：–—]\s*([^\n/|｜,，]+?)(?=\s*(?:[,，]|[/|／·｜]|\n|$|석식|저녁))/i) ||
      folded.match(/\[?\s*(?:중식|점심)\s*\]?\s*[:：]?\s*([^\n[/\[]+?)(?=\s*(?:\n|$|\[?\s*(?:석식|저녁)))/i)
    assignMealField(out, 'lunchText', lp?.[1])
  }
  if (!out.dinnerText) {
    const dp =
      folded.match(/(?:석식|저녁)\s*[-:：–—]\s*([^\n]+)/i) ||
      folded.match(/\[?\s*(?:석식|저녁)\s*\]?\s*[:：]?\s*([^\n\[]+)/i)
    assignMealField(out, 'dinnerText', dp?.[1])
  }

  if (out.breakfastText || out.lunchText || out.dinnerText) {
    buildMealSummary(out)
    return out
  }

  const mealOnly = folded.match(/식사\s*[:：]\s*([^\n]+)/i)
  if (mealOnly?.[1]?.trim()) {
    out.mealSummaryText = normalizeScheduleMealCapture(mealOnly[1]).slice(0, 500)
  }
  return out
}

/** 개별 필드가 비었을 때 mealSummaryText·description에서 보강 */
export function enrichScheduleMealFieldsFromText(
  row: ParsedScheduleMealFields,
  sources: Array<string | null | undefined>,
): ParsedScheduleMealFields {
  const out: ParsedScheduleMealFields = { ...row }
  const needs =
    isEmptyMealHotelField(out.breakfastText) &&
    isEmptyMealHotelField(out.lunchText) &&
    isEmptyMealHotelField(out.dinnerText)
  if (!needs) return out

  for (const src of sources) {
    const parsed = parseScheduleMealFieldsFromText(src)
    if (!parsed.breakfastText && !parsed.lunchText && !parsed.dinnerText && !parsed.mealSummaryText) {
      continue
    }
    if (isEmptyMealHotelField(out.breakfastText) && parsed.breakfastText) {
      out.breakfastText = parsed.breakfastText
    }
    if (isEmptyMealHotelField(out.lunchText) && parsed.lunchText) {
      out.lunchText = parsed.lunchText
    }
    if (isEmptyMealHotelField(out.dinnerText) && parsed.dinnerText) {
      out.dinnerText = parsed.dinnerText
    }
    if (isEmptyMealHotelField(out.mealSummaryText) && parsed.mealSummaryText) {
      out.mealSummaryText = parsed.mealSummaryText
    }
    break
  }
  return out
}
