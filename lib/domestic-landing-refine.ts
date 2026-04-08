import type { GalleryProduct } from '@/app/api/gallery/route'
import type { DomesticSpecialMode } from '@/lib/domestic-landing-nav-data'
import { triageProductTitleForPickTab } from '@/lib/gallery-product-triage'

export type DomesticRefineState = {
  regionGroupKey: string | null
  narrowText: string
  priceMin: string
  priceMax: string
  departFrom: string
  departTo: string
  transport: 'all' | 'bus' | 'train' | 'ship' | 'car' | 'other'
  departConfirmed: 'all' | 'yes' | 'no'
  productType: 'all' | 'package' | 'custom'
}

export const DEFAULT_DOMESTIC_REFINE: DomesticRefineState = {
  regionGroupKey: null,
  narrowText: '',
  priceMin: '',
  priceMax: '',
  departFrom: '',
  departTo: '',
  transport: 'all',
  departConfirmed: 'all',
  productType: 'all',
}

function haystack(p: GalleryProduct): string {
  return `${p.title} ${p.primaryDestination ?? ''} ${p.destinationRaw ?? ''} ${p.destination ?? ''} ${p.primaryRegion ?? ''} ${p.themeTags ?? ''}`.toLowerCase()
}

function parseDurationNights(duration: string): number | null {
  const m = duration.match(/(\d+)\s*박/)
  if (m) return parseInt(m[1], 10)
  const d = duration.match(/(\d+)\s*일/)
  if (d) return Math.max(0, parseInt(d[1], 10) - 1)
  return null
}

export function buildDomesticSpecialAndRefinePredicate(
  refine: DomesticRefineState,
  specialMode: DomesticSpecialMode | null
): (p: GalleryProduct) => boolean {
  return (p) => {
    if (specialMode === 'closing') {
      if (!p.departureDate) return false
      const d = new Date(p.departureDate)
      const t = Date.now()
      const days = (d.getTime() - t) / 86400000
      if (days < 0 || days > 21) return false
    }
    if (specialMode === 'value') {
      if (p.priceKrw == null || p.priceKrw <= 0 || p.priceKrw > 450_000) return false
    }
    if (specialMode === 'consult') {
      const h = `${p.title} ${p.themeTags ?? ''}`
      if (!/(문의|상담|인기|추천|best|hot)/i.test(h)) return false
    }
    if (specialMode === 'season') {
      const h = haystack(p)
      if (!/(봄|여름|가을|겨울|단풍|벚꽃|설경|여름휴가)/.test(h)) return false
    }

    const min = parseInt(refine.priceMin, 10)
    const max = parseInt(refine.priceMax, 10)
    if (!Number.isNaN(min) && min > 0 && (p.priceKrw == null || p.priceKrw < min)) return false
    if (!Number.isNaN(max) && max > 0 && (p.priceKrw == null || p.priceKrw > max)) return false

    if (refine.departFrom.trim()) {
      const from = refine.departFrom.slice(0, 10)
      if (!p.departureDate || p.departureDate.slice(0, 10) < from) return false
    }
    if (refine.departTo.trim()) {
      const to = refine.departTo.slice(0, 10)
      if (!p.departureDate || p.departureDate.slice(0, 10) > to) return false
    }

    if (refine.departConfirmed === 'yes' && !p.departureDate) return false
    if (refine.departConfirmed === 'no' && p.departureDate) return false

    if (refine.transport !== 'all') {
      const h = haystack(p)
      if (refine.transport === 'bus' && !h.includes('버스')) return false
      if (refine.transport === 'train' && !/(기차|ktx|열차|철도)/.test(h)) return false
      if (refine.transport === 'ship' && !/(배|페리|유람|크루즈|선박)/.test(h)) return false
      if (refine.transport === 'car' && !/(자가|렌터카|승용)/.test(h)) return false
      if (refine.transport === 'other' && /버스|ktx|기차|열차|배|페리|유람|크루즈/.test(h)) return false
    }

    if (refine.productType === 'package') {
      const t = p.title
      if (/(자유|에어텔|항공\s*\+\s*호텔)/.test(t)) return false
      const tab = triageProductTitleForPickTab(t)
      if (tab === 'freeform') return false
    }
    if (refine.productType === 'custom') {
      if (!/(맞춤|단체|워크샵|기업|학교)/.test(p.title)) return false
    }

    const q = refine.narrowText.trim().toLowerCase()
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean)
      const h = haystack(p)
      if (!tokens.every((t) => h.includes(t))) return false
    }

    return true
  }
}

/** 일정 축 보조 필터 — 토큰 하나라도 맞으면 통과(OR) */
export function domesticScheduleMatchesTerms(p: GalleryProduct, terms: string[]): boolean {
  if (terms.length === 0) return true
  const h = haystack(p)
  return terms.some((raw) => {
    const t = raw.toLowerCase()
    if (t.includes('당일')) return parseDurationNights(p.duration) === 0 || /당일|당일치기/.test(h)
    if (t.includes('1박')) return parseDurationNights(p.duration) === 1 || h.includes('1박')
    if (t.includes('2박') || t.includes('3박') || t.includes('장기')) {
      const n = parseDurationNights(p.duration)
      return (n != null && n >= 2) || h.includes('2박') || h.includes('3박')
    }
    if (t.includes('주말')) {
      if (!p.departureDate) return false
      const w = new Date(p.departureDate).getDay()
      return w === 0 || w === 6 || w === 5
    }
    if (t.includes('평일')) {
      if (!p.departureDate) return false
      const w = new Date(p.departureDate).getDay()
      return w >= 1 && w <= 4
    }
    return h.includes(t)
  })
}
