/**
 * 공개 상세 현지옵션 — 표형 vs 간단형 분기(데이터 소스·입력 구조는 변경하지 않음).
 */
import type { UiOptionalTourRow } from '@/lib/optional-tours-ui-model'

export function hasMeaningfulOptionalTourPrice(row: UiOptionalTourRow): boolean {
  if (row.adultPrice != null || row.childPrice != null) return true
  const p = (row.priceDisplay ?? '').trim()
  if (!p || p === '문의' || p === '—') return false
  return /\d/.test(p)
}

/** 관광명 제외, 표에 실을 만한 칸이 몇 칸 채워졌는지(0~6) */
function optionalRowDetailScore(row: UiOptionalTourRow): number {
  let n = 0
  if (row.currency?.trim()) n += 1
  if (hasMeaningfulOptionalTourPrice(row)) n += 1
  if (row.durationText?.trim()) n += 1
  if (row.minPaxText?.trim()) n += 1
  if (row.guideText?.trim()) n += 1
  if (row.waitingText?.trim()) n += 1
  return n
}

/**
 * 행마다 세부 칸이 어느 정도 채워졌을 때만 넓은 표를 쓴다.
 * 그렇지 않으면 관광명·비용·신청 중심 카드형.
 */
export function shouldRenderOptionalTourWideTable(rows: UiOptionalTourRow[]): boolean {
  if (rows.length === 0) return false
  const hanatourShaped = rows.some(
    (r) =>
      (r.supplierTags?.length ?? 0) > 0 ||
      r.includedNoExtraCharge === true ||
      Boolean(r.alternateScheduleText?.trim()) ||
      Boolean(r.descriptionBody?.trim())
  )
  if (hanatourShaped) return false
  const scores = rows.map(optionalRowDetailScore)
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const max = Math.max(...scores, 0)
  if (rows.length === 1) return max >= 4
  return avg >= 2.25 && max >= 3
}

/**
 * 일정 포함·추가요금 없음 후보(스페셜포함). `[하나팩]`은 상품군 라벨이므로 여기서 제외.
 */
export function isOptionalTourLikelyIncludedNoCharge(
  tourName: string,
  row?: Pick<UiOptionalTourRow, 'includedNoExtraCharge' | 'supplierTags' | 'priceDisplay'>
): boolean {
  if (row?.includedNoExtraCharge === true) return true
  if (row?.priceDisplay?.trim() === '포함') return true
  if (row?.supplierTags?.some((t) => /스페셜/i.test(t))) return true
  const n = tourName.replace(/\s+/g, ' ').trim()
  if (!n) return false
  if (/스페셜\s*포함|특전\s*포함|\[?\s*스페셜포함\s*\]?/i.test(n)) return true
  return false
}
