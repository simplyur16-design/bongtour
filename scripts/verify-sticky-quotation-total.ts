/**
 * 스티키 카드 예상 합계 — 공급사별 단가 규칙 스모크.
 */
import assert from 'node:assert/strict'
import {
  computeStickyDisplayQuotationTotal,
  getStickyQuotationSummary,
} from '@/lib/public-sticky-pax-display'

const row = {
  adult: 999_000,
  childBed: 999_000,
  childNoBed: 800_000,
  infant: 100_000,
  priceAdult: 999_000,
  priceChildWithBed: 999_000,
  priceChildNoBed: 800_000,
  priceInfant: 100_000,
}

const pax = { adult: 2, childBed: 1, childNoBed: 0, infant: 1 }

assert.equal(
  computeStickyDisplayQuotationTotal(row, pax, 'verygoodtour'),
  999_000 * 3 + 100_000
)
assert.equal(
  computeStickyDisplayQuotationTotal(row, pax, 'modetour'),
  999_000 * 2 + 999_000 + 100_000
)

const incomplete = getStickyQuotationSummary(
  { ...row, infant: 0, priceInfant: null },
  { adult: 1, childBed: 0, childNoBed: 0, infant: 1 },
  'verygoodtour'
)
assert.equal(incomplete.hasIncompletePricedPax, true)

console.log('[verify-sticky-quotation-total] ok')
