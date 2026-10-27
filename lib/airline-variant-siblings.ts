/**
 * 상품 상세 항공사 선택 — 같은 그룹 키의 공개 형제 상품 (읽기 전용 조회).
 * REGRESSION-FREEZE[airline-variant-group]: 상세 항공사 선택은 같은 그룹 키 공개 상품만 — manifest
 */
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { toSeoulYmd } from '@/lib/public-bookable-date'
import {
  airlineVariantGroupKey,
  airlineVariantLabel,
  parseSupplierProductCodeForAirlineVariant,
  resolveAirlineVariantAirlineCode,
  sortAirlineVariantOptions,
  type AirlineVariantInput,
  type AirlineVariantOption,
} from '@/lib/airline-variant-group'

const SIBLING_SELECT = {
  id: true,
  slug: true,
  originSource: true,
  originCode: true,
  title: true,
  duration: true,
  tripNights: true,
  tripDays: true,
  localDepartureTag: true,
  minBookableAdultPrice: true,
  priceFrom: true,
  nextBookableDepartureAt: true,
  departures: {
    where: { outboundFlightNo: { not: null } },
    orderBy: { departureDate: 'asc' as const },
    take: 1,
    select: { outboundFlightNo: true },
  },
} as const

type SiblingRow = {
  id: string
  slug: string | null
  originSource: string
  originCode: string
  title: string
  duration: string | null
  tripNights: number | null
  tripDays: number | null
  localDepartureTag: string[]
  minBookableAdultPrice: number | null
  priceFrom: number | null
  nextBookableDepartureAt: Date | null
  departures: Array<{ outboundFlightNo: string | null }>
}

function toInput(r: SiblingRow): AirlineVariantInput {
  return {
    id: r.id,
    originSource: r.originSource,
    originCode: r.originCode,
    title: r.title,
    duration: r.duration,
    tripNights: r.tripNights,
    tripDays: r.tripDays,
    localDepartureTag: r.localDepartureTag,
    outboundFlightNo: r.departures[0]?.outboundFlightNo ?? null,
  }
}

async function loadAirlineVariantOptionsUncached(productId: string): Promise<AirlineVariantOption[]> {
  const self = (await prisma.product.findUnique({
    where: { id: productId },
    select: SIBLING_SELECT,
  })) as SiblingRow | null
  if (!self) return []
  const parts = parseSupplierProductCodeForAirlineVariant(self.originSource, self.originCode)
  if (!parts) return []
  const selfKey = airlineVariantGroupKey(toInput(self))
  if (!selfKey) return []
  const rows = (await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      originSource: self.originSource,
      originCode: { startsWith: parts.masterCode },
      AND: [publicProductWhereClause()],
    },
    select: SIBLING_SELECT,
    take: 60,
  })) as SiblingRow[]
  const options: AirlineVariantOption[] = []
  for (const r of rows) {
    const input = toInput(r)
    if (airlineVariantGroupKey(input) !== selfKey) continue
    const code = resolveAirlineVariantAirlineCode(input)
    if (!code) continue
    const price = r.minBookableAdultPrice ?? r.priceFrom ?? null
    options.push({
      productId: r.id,
      slug: r.slug,
      airlineCode: code,
      airlineLabel: airlineVariantLabel(code),
      priceKrw: price != null && price > 0 ? price : null,
      earliestDeparture: r.nextBookableDepartureAt ? toSeoulYmd(r.nextBookableDepartureAt) : null,
    })
  }
  if (!options.some((o) => o.productId === productId)) return []
  return options.length >= 2 ? sortAirlineVariantOptions(options) : []
}

export function loadAirlineVariantOptionsForProduct(productId: string): Promise<AirlineVariantOption[]> {
  return unstable_cache(
    () => loadAirlineVariantOptionsUncached(productId),
    ['airline-variant-options-v1', productId],
    { revalidate: 900, tags: ['products-browse'] },
  )()
}
