/**
 * 공개 상세 스티키 견적 카드 — 공급사별 인원 라벨·현지합류 보조 줄(대표가/합계와 분리).
 * 1인 객실 사용료는 가격 행에 넣지 않음(singleRoom* / 불포함 탭 축).
 */
import type { PublicProductPriceRow } from '@/lib/price-utils'
import { normalizeSupplierOrigin, type OverseasSupplierKey } from '@/lib/normalize-supplier-origin'
import { getStickyDisplayPerPaxKrw } from '@/lib/public-sticky-pax-display'

/** 스티키 카드 인원 행(실제 DB 슬롯 키와 연결). */
export type StickyPaxUiRow =
  | { kind: 'slot'; paxKey: 'adult' | 'childBed' | 'childNoBed' | 'infant'; label: string }
  | { kind: 'childCombined'; label: string }

export type StickyQuotePriceRow = PublicProductPriceRow

/**
 * `excludedText`·`priceTableRawText`에서 성인 현지합류 1인당 원화만 추출(표시 전용, 합계 미사용).
 * 하나투어 등록: `[요금 안내] 현지합류 2,490,000원 / …` 또는 `현지합류` 행의 첫 원화.
 */
export function parseLocalJoinAdultKrwFromSupplierTexts(
  excludedText?: string | null,
  priceTableRawText?: string | null
): number | null {
  const hay = [excludedText, priceTableRawText].filter((x): x is string => Boolean(x?.trim())).join('\n')
  if (!hay.trim()) return null

  const mBracket = hay.match(/\[요금\s*안내\]\s*현지합류\s*([\d,]+)\s*원/i)
  if (mBracket?.[1]) {
    const n = Number(mBracket[1].replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }

  const lines = hay.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (!/^현지\s*합류/i.test(line) && !/^현지합류/i.test(line)) continue
    const m = line.match(/([\d,]+)\s*원/)
    if (m?.[1]) {
      const n = Number(m[1].replace(/,/g, ''))
      if (Number.isFinite(n) && n > 0) return Math.round(n)
    }
  }
  return null
}

/**
 * 스티키 카드 보조 줄 — 모두투어는 항상 null. 하나투어·참좋은·ybtour만 성인 현지합류가 있을 때 1줄.
 */
export function getStickyLocalJoinAuxiliaryLine(input: {
  originSource: string | null | undefined
  excludedText?: string | null
  priceTableRawText?: string | null
}): string | null {
  const key = normalizeSupplierOrigin(input.originSource)
  if (key === 'modetour') return null
  if (key !== 'hanatour' && key !== 'verygoodtour' && key !== 'ybtour') return null

  const krw = parseLocalJoinAdultKrwFromSupplierTexts(input.excludedText, input.priceTableRawText)
  if (krw == null || krw <= 0) return null
  return `현지합류 가격 ${krw.toLocaleString('ko-KR')}원`
}

function fallbackSlotHasDisplayUnit(
  row: StickyQuotePriceRow | null,
  slot: 'adult' | 'childBed' | 'childNoBed' | 'infant',
  originSource: string | null | undefined
): boolean {
  if (!row) return slot === 'adult'
  return getStickyDisplayPerPaxKrw(row, slot, originSource) != null
}

/**
 * 모두투어: 성인 / 아동(EXTRA BED·NO BED) / 유아 — EXTRA·NO BED는 성인가가 있으면 노출(NO BED는 값 없을 수 있음).
 * 하나투어·참좋은·ybtour: 성인가 있으면 아동 행(표시는 성인과 동일) / 유아는 저장값 있을 때만.
 */
export function buildStickyPaxRows(
  originSource: string | null | undefined,
  priceRow: StickyQuotePriceRow | null
): StickyPaxUiRow[] {
  const key: OverseasSupplierKey = normalizeSupplierOrigin(originSource)

  if (key === 'modetour') {
    const out: StickyPaxUiRow[] = [{ kind: 'slot', paxKey: 'adult', label: '성인' }]
    const uAdult = priceRow ? getStickyDisplayPerPaxKrw(priceRow, 'adult', originSource) : null
    if (uAdult != null) {
      out.push({ kind: 'slot', paxKey: 'childBed', label: '아동(EXTRA BED)' })
      out.push({ kind: 'slot', paxKey: 'childNoBed', label: '아동(NO BED)' })
    }
    if (priceRow && getStickyDisplayPerPaxKrw(priceRow, 'infant', originSource) != null) {
      out.push({ kind: 'slot', paxKey: 'infant', label: '유아' })
    }
    return out
  }

  if (key === 'hanatour' || key === 'verygoodtour' || key === 'ybtour') {
    const out: StickyPaxUiRow[] = [{ kind: 'slot', paxKey: 'adult', label: '성인' }]
    const uAdult = priceRow ? getStickyDisplayPerPaxKrw(priceRow, 'adult', originSource) : null
    if (uAdult != null) {
      out.push({ kind: 'childCombined', label: '아동' })
    }
    if (priceRow && getStickyDisplayPerPaxKrw(priceRow, 'infant', originSource) != null) {
      out.push({ kind: 'slot', paxKey: 'infant', label: '유아' })
    }
    return out
  }

  /** 기타 공급사: 저장 공개 단가가 있는 슬롯만(표시=저장과 동일). */
  const fallback: StickyPaxUiRow[] = [{ kind: 'slot', paxKey: 'adult', label: '성인' }]
  if (fallbackSlotHasDisplayUnit(priceRow, 'childBed', originSource)) {
    fallback.push({ kind: 'slot', paxKey: 'childBed', label: '아동(EXTRA BED)' })
  }
  if (fallbackSlotHasDisplayUnit(priceRow, 'childNoBed', originSource)) {
    fallback.push({ kind: 'slot', paxKey: 'childNoBed', label: '아동(NO BED)' })
  }
  if (fallbackSlotHasDisplayUnit(priceRow, 'infant', originSource)) {
    fallback.push({ kind: 'slot', paxKey: 'infant', label: '유아' })
  }
  return fallback
}
