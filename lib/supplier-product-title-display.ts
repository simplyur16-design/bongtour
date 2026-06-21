/**
 * 방안 B — 공급사 원문 기반 노출 상품명(Product.title) SSOT.
 * REGRESSION-FREEZE[supplier-product-title-plan-b]
 * 마케팅 축약·R-5 LLM 자동 저장 금지 — Product.title 노출명 SSOT.
 *
 * - originalTitle: 붙여넣기·파싱 원문(최소 trim)
 * - display title: UI 노이즈·무쇼핑/무옵션/직항 배지만 제거, 나머지 원문 유지
 */
import { isSupplierListingTitleUnacceptable } from '@/lib/supplier-listing-title-unacceptable'

export const SUPPLIER_PRODUCT_TITLE_DISPLAY_POLICY_VERSION = 'plan-b-v2-2026-06-19'

/** Product.title·메타 상한 — bongtour-product-title-tone HARD_MAX 와 동일 */
export const SUPPLIER_PRODUCT_DISPLAY_TITLE_MAX = 90

const UI_NOISE_CHARS = ['★', '※', '◎', '◆', '▶'] as const

function uniqueTitleCandidates(...parts: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const t = (p ?? '').trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export function resolveSupplierVerbatimOriginalTitle(args: {
  parsedSupplierTitle: string
  supplierListingTitleRaw?: string | null
  brandKey?: string
}): string {
  const candidates = uniqueTitleCandidates(
    args.supplierListingTitleRaw,
    args.parsedSupplierTitle,
  )
  for (const c of candidates) {
    if (c.length >= 4 && !isSupplierListingTitleUnacceptable(c, args.brandKey)) return c
  }
  return '미입력'
}

/** 공백·NBSP·UI 장식(★※▶)만 정리 */
export function stripSupplierTitleUiNoise(s: string): string {
  let t = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  t = t.replace(/[\u00a0\u3000]+/g, ' ')
  for (const ch of UI_NOISE_CHARS) {
    t = t.split(ch).join('')
  }
  return t.replace(/\s+/g, ' ').trim()
}

function isPromoOnlyBadgeText(raw: string): boolean {
  let t = raw.trim().replace(/\s/g, '').replace(/^#/, '')
  if (!t) return true
  t = t.replace(/^노팁/, '')
  if (!t) return true
  return /^(?:무(?:쇼핑|옵션)|노(?:쇼핑|옵션)|직항|출발\s*확정|긴급\s*모객|nooption|noshopping)$/i.test(
    t.replace(/\s/g, ''),
  )
}

/** 무쇼핑·무옵션·직항 등 마케팅 배지만 제거 — [지역]·[항공사]·일반 #태그는 유지 */
export function stripSupplierTitlePromoBadges(s: string): string {
  let t = s
  t = t.replace(/\[\s*([^\]]*?)\s*\]/g, (m, inner: string) => (isPromoOnlyBadgeText(inner) ? ' ' : m))
  t = t.replace(/#[^\s#]+/g, (m) => (isPromoOnlyBadgeText(m.slice(1)) ? ' ' : m))
  return t.replace(/\s+/g, ' ').trim()
}

function normalizeSupplierTitleForDisplay(s: string): string {
  return stripSupplierTitlePromoBadges(stripSupplierTitleUiNoise(s))
}

export type SupplierProductDisplayTitleInput = {
  verbatimOriginal: string
  parsedSupplierTitle?: string
  brandKey?: string
}

/** Plan B 노출명 — 원문 기반 경량 정리. 출발일 구간·박일만 줄은 거부 */
export function buildSupplierProductDisplayTitle(input: SupplierProductDisplayTitleInput): string {
  const candidates = uniqueTitleCandidates(
    normalizeSupplierTitleForDisplay(input.verbatimOriginal),
    normalizeSupplierTitleForDisplay(input.parsedSupplierTitle ?? ''),
  ).filter((t) => t.length >= 4)

  for (const c of candidates) {
    const clipped = c.slice(0, SUPPLIER_PRODUCT_DISPLAY_TITLE_MAX)
    if (isSupplierListingTitleUnacceptable(clipped, input.brandKey)) continue
    return clipped
  }
  return '미입력'
}
