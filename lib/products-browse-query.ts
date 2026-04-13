import type { BrowseSort } from '@/lib/products-browse-filter'

/** 구 URL·사이드바 호환 — 운영 상품유형(에어텔/단독/프리미엄 키워드) 필터 */
export type ProductCategoryFilter = 'airtel' | 'private' | 'premium'

export type BrowseQueryState = {
  type: string | null
  sort: BrowseSort
  region: string | null
  country: string | null
  city: string | null
  regionPref: string | null
  /** 인당 예산 상한(원) — 등록 상품 실제 인당 최저가와 비교 */
  budgetPerPerson: number | null
  /** 인당 예산 하한(원) */
  budgetMin: number | null
  tripDays: number | null
  departMonth: string | null
  page: number
  limit: number
  noOptionalTour: boolean
  noShopping: boolean
  brands: string[]
  /** @deprecated 좌측에서 제거됨 — 구 bookmark용 파싱만 유지 */
  categories: ProductCategoryFilter[]
  airlines: string[]
  departHours: string[]
  /** 0=일 … 6=토 */
  departWeekdays: number[]
}

const DAY_KEYS: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

const DAY_REV = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function parseBool(v: string | null): boolean {
  return v === '1' || v === 'true' || v === 'yes'
}

function parseIntSafe(v: string | null): number | null {
  if (v == null || v === '') return null
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? null : n
}

function parseMulti(raw: string | null): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseCategories(raw: string | null, repeated: string[]): ProductCategoryFilter[] {
  const set = new Set<ProductCategoryFilter>()
  for (const r of [...parseMulti(raw), ...repeated]) {
    const u = r.toLowerCase()
    if (u === 'airtel' || u === 'private' || u === 'premium') set.add(u)
  }
  return [...set]
}

function parseWeekdays(raw: string | null, repeated: string[]): number[] {
  const set = new Set<number>()
  const fromList = [...parseMulti(raw), ...repeated]
  for (const x of fromList) {
    const k = x.toLowerCase().trim()
    if (k in DAY_KEYS) set.add(DAY_KEYS[k]!)
    else {
      const n = parseInt(k, 10)
      if (!Number.isNaN(n) && n >= 0 && n <= 6) set.add(n)
    }
  }
  return [...set].sort((a, b) => a - b)
}

export function parseBrowseQuery(searchParams: URLSearchParams): BrowseQueryState {
  const sortRaw = searchParams.get('sort')
  const sort: BrowseSort =
    sortRaw === 'budget_fit' ||
    sortRaw === 'price_asc' ||
    sortRaw === 'price_desc' ||
    sortRaw === 'popular' ||
    sortRaw === 'departure_asc'
      ? sortRaw
      : 'popular'

  const repeatedBrand = searchParams.getAll('brand')
  const repeatedAirline = searchParams.getAll('airline')
  const repeatedCat = searchParams.getAll('category')
  const repeatedHour = searchParams.getAll('departHour')
  const repeatedDay = searchParams.getAll('departDay')

  const brands = [...new Set([...parseMulti(searchParams.get('brands')), ...repeatedBrand])]

  return {
    type: searchParams.get('type'),
    sort,
    region: searchParams.get('region'),
    country: searchParams.get('country'),
    city: searchParams.get('city'),
    regionPref: searchParams.get('regionPref'),
    budgetPerPerson: parseIntSafe(searchParams.get('budgetPerPerson')),
    budgetMin: parseIntSafe(searchParams.get('budgetMin')),
    tripDays: parseIntSafe(searchParams.get('tripDays')),
    departMonth: searchParams.get('departMonth'),
    page: Math.max(1, parseIntSafe(searchParams.get('page')) ?? 1),
    limit: Math.min(60, Math.max(1, parseIntSafe(searchParams.get('limit')) ?? 24)),
    noOptionalTour: parseBool(searchParams.get('noOptionalTour')),
    noShopping: parseBool(searchParams.get('noShopping')),
    brands,
    categories: parseCategories(searchParams.get('categories'), repeatedCat),
    airlines: [...new Set([...parseMulti(searchParams.get('airlines')), ...repeatedAirline])],
    departHours: [...new Set([...parseMulti(searchParams.get('departHours')), ...repeatedHour])],
    departWeekdays: parseWeekdays(searchParams.get('departWeekdays'), repeatedDay),
  }
}

export function serializeBrowseQuery(state: BrowseQueryState): string {
  const p = new URLSearchParams()
  const set = (k: string, v: string | number | null | undefined) => {
    if (v == null || v === '') return
    p.set(k, String(v))
  }

  if (state.type) set('type', state.type)
  if (state.sort && state.sort !== 'popular') set('sort', state.sort)
  if (state.region) set('region', state.region)
  if (state.country) set('country', state.country)
  if (state.city) set('city', state.city)
  if (state.regionPref) set('regionPref', state.regionPref)
  if (state.budgetPerPerson != null) set('budgetPerPerson', state.budgetPerPerson)
  if (state.budgetMin != null) set('budgetMin', state.budgetMin)
  if (state.tripDays != null) set('tripDays', state.tripDays)
  if (state.departMonth) set('departMonth', state.departMonth)
  if (state.page > 1) set('page', state.page)
  if (state.limit !== 24) set('limit', state.limit)
  if (state.noOptionalTour) set('noOptionalTour', 'true')
  if (state.noShopping) set('noShopping', 'true')
  for (const b of state.brands) p.append('brand', b)
  for (const c of state.categories) p.append('category', c)
  for (const a of state.airlines) p.append('airline', a)
  for (const h of state.departHours) p.append('departHour', h)
  for (const d of state.departWeekdays) {
    p.append('departDay', DAY_REV[d] ?? String(d))
  }
  return p.toString()
}

export function weekdayToParam(d: number): string {
  return DAY_REV[d] ?? String(d)
}

export function mergeBrowseQuery(
  current: BrowseQueryState,
  patch: Partial<BrowseQueryState>
): BrowseQueryState {
  return { ...current, ...patch }
}
