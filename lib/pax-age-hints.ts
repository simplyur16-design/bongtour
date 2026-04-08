/**
 * 인원 카드 연령 기준 — 공급사 본문(가격표·포함/불포함)에서 괄호 구간 우선 추출, 없으면 fallback.
 */

const CHILD_FALLBACK = '만 2세 이상 ~ 만 12세 미만'
/** 인원 카드 라벨에 포함 — 보조 줄과 중복하지 않음 */
export const INFANT_LABEL_AGE = '만 2세 이하'

export type PaxAgeExtracted = {
  /** 괄호 안 문자열만 (표시 시 전체 `(…)` 로 감쌈) */
  adultInner: string | null
  childInner: string | null
  infantInner: string | null
}

/**
 * 본문 blob에서 성인/아동/유아 연령 괄호 후보 추출.
 */
export function extractPaxAgeHintsFromSupplierText(raw: string | null | undefined): PaxAgeExtracted {
  const t = (raw ?? '').replace(/\r/g, '\n')
  if (!t.trim()) return { adultInner: null, childInner: null, infantInner: null }

  let adultInner: string | null = null
  let childInner: string | null = null
  let infantInner: string | null = null

  const mAdult = t.match(/(?:성인|대인)[^\n(]{0,40}\(([^)]+)\)/)
  if (mAdult?.[1]?.trim()) adultInner = mAdult[1].replace(/\s+/g, ' ').trim()

  const mChildRange = t.match(
    /\(\s*만\s*2\s*세\s*이상\s*[~～〜\-]\s*만\s*12\s*세\s*미만\s*\)/
  )
  if (mChildRange) childInner = CHILD_FALLBACK

  if (!childInner) {
    const mChild = t.match(/(?:아동|소아|CHILD|child)[^\n(]{0,40}\(([^)]+)\)/i)
    if (mChild?.[1]?.trim() && /\d|세|만/.test(mChild[1])) {
      childInner = mChild[1].replace(/\s+/g, ' ').trim()
    }
  }

  const mInf = t.match(/(?:유아|INFANT|infant)[^\n(]{0,40}\(([^)]+)\)/i)
  if (mInf?.[1]?.trim()) infantInner = mInf[1].replace(/\s+/g, ' ').trim()

  if (!infantInner && /만\s*2\s*세\s*(미만|이하)/.test(t)) {
    infantInner = INFANT_LABEL_AGE
  }

  return { adultInner, childInner, infantInner }
}

export function formatPaxAgeParen(inner: string): string {
  const s = inner.replace(/\s+/g, ' ').trim()
  return s ? `(${s})` : ''
}

export function paxAgeLineForSlot(
  slot: 'adult' | 'childBed' | 'childNoBed' | 'infant',
  extracted: PaxAgeExtracted
): string | null {
  /** 성인: 유류할증료 등 가격 부가 안내는 카드에서 제외(요청) */
  if (slot === 'adult') {
    return null
  }
  if (slot === 'infant') {
    return formatPaxAgeParen(extracted.infantInner ?? '만 2세 미만')
  }
  return formatPaxAgeParen(extracted.childInner ?? CHILD_FALLBACK)
}
