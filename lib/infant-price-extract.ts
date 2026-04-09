/**
 * 본문/가격표에서 유아 단가(원) 보조 추출 — LLM 누락 시 후처리.
 */

export type InfantPriceFieldIssue = {
  field: 'infantPrice'
  reason: string
  source: 'auto'
  severity: 'warn'
}

/** 본문에 유아 요금 숫자가 있을 가능성이 높은지(휴리스틱) */
export function hintInfantPriceInPaste(hay: string): boolean {
  if (!hay?.trim()) return false
  const t = hay.replace(/\r/g, '')
  if (!/(유아|소아|INFANT|infant|만\s*2\s*세\s*미만|유아\s*요금)/i.test(t)) return false
  return /\d/.test(t)
}

/**
 * 유아 열/라벨 인근 금액 추출(원화).
 * 예: 유아 71,000원 · 유아(만 2세 미만) 71,000 · INFANT 71,000
 */
export function extractInfantPriceKrwFromText(hay: string): number | null {
  if (!hay?.trim()) return null
  const t = hay.replace(/\r/g, ' ')

  const tryParse = (s: string): number | null => {
    const n = parseInt(s.replace(/,/g, ''), 10)
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  const linePatterns: RegExp[] = [
    /유아\s*요금\s*[:：]?\s*([\d,]{2,12})\s*원/i,
    /유아\s*(?:\([^)]{0,40}\))?\s*[:：]?\s*([\d,]{2,12})\s*원/i,
    /유아\s+([\d,]{2,12})\s*원/i,
    /** 표·본문에서 유아 라벨과 금액이 줄바꿈으로 떨어진 경우 (예: 유아 / (만 2세 미만) / 71,000원) */
    /(?:^|[\n\r])\s*유아(?:\s*\([^)]{0,60}\))?[\s\S]{0,160}?([\d,]{2,12})\s*원/is,
    /(?:INFANT|infant)\s*[:：]?\s*([\d,]{2,12})/i,
    /만\s*2\s*세\s*미만[^\d]{0,24}([\d,]{2,12})\s*원/i,
    /소아\s*\(\s*만\s*2\s*세\s*미만\s*\)\s*[:：]?\s*([\d,]{2,12})\s*원/i,
    /소아\s*요금[^\d]{0,20}([\d,]{2,12})\s*원/i,
  ]

  for (const re of linePatterns) {
    const m = t.match(re)
    if (m?.[1]) {
      const n = tryParse(m[1])
      if (n != null && n > 0) return n
    }
  }

  /** 표에서 `유아` 셀과 금액 셀이 떨어져 있거나, 위 패턴이 놓친 경우 — 유아 이후 첫 `N원`(유류·제세 직전 금액 제외) */
  const relaxed = t.replace(/\u00a0/g, ' ')
  const idx = relaxed.search(/(?:^|[\n\r])\s*유아\b/i)
  if (idx >= 0) {
    const slice = relaxed.slice(idx, idx + 280)
    const won = slice.match(/([\d,]{2,12})\s*원/g)
    if (won?.length) {
      for (const w of won) {
        const pos = slice.indexOf(w)
        const pre = slice.slice(Math.max(0, pos - 14), pos)
        if (/(유류|제세|할증|공과)\s*$/i.test(pre)) continue
        const mm = w.match(/([\d,]{2,12})/)
        if (mm?.[1]) {
          const n = tryParse(mm[1])
          if (n != null && n > 0 && n < 50_000_000) return n
        }
      }
    }
  }

  return null
}

type ProductPriceTableLike = {
  adultPrice?: number | null
  childExtraBedPrice?: number | null
  childNoBedPrice?: number | null
  infantPrice?: number | null
}

/**
 * LLM productPriceTable에 정규식으로 보완한 infantPrice를 병합하고,
 * 본문 힌트는 있는데 금액을 못 채우면 fieldIssues 항목을 반환.
 */
export function mergeInfantPriceIntoProductPriceTable(
  table: ProductPriceTableLike | null,
  priceBlob: string
): { productPriceTable: ProductPriceTableLike | null; issues: InfantPriceFieldIssue[] } {
  const issues: InfantPriceFieldIssue[] = []
  const hinted = hintInfantPriceInPaste(priceBlob)
  const extracted = extractInfantPriceKrwFromText(priceBlob)
  const llmInf = table?.infantPrice

  let infantPrice: number | null =
    llmInf != null && Number.isFinite(llmInf) && llmInf > 0 ? Math.round(Number(llmInf)) : null

  if (extracted != null && extracted > 0) {
    infantPrice = extracted
  }

  if (hinted && infantPrice == null) {
    issues.push({
      field: 'infantPrice',
      reason: '본문/가격표에 유아 가격이 있으나 구조화 실패',
      source: 'auto',
      severity: 'warn',
    })
  }

  if (!table) {
    if (infantPrice != null && infantPrice > 0) {
      return {
        productPriceTable: {
          adultPrice: null,
          childExtraBedPrice: null,
          childNoBedPrice: null,
          infantPrice,
        },
        issues,
      }
    }
    return { productPriceTable: null, issues }
  }

  return {
    productPriceTable: {
      ...table,
      infantPrice: infantPrice ?? table.infantPrice ?? null,
    },
    issues,
  }
}
