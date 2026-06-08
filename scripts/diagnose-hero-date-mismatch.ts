/**
 * 출발·귀국 요약 vs 가는편/오는편 facts 불일치 상품 스캔.
 * 실행: npx tsx scripts/diagnose-hero-date-mismatch.ts
 */
import { PrismaClient } from '@prisma/client'
import { productDepartureToKeyFacts, type DepartureKeyFacts } from '@/lib/departure-key-facts'
import { alignDepartureKeyFactsToSelectedCalendarDate } from '@/lib/departure-facts-calendar-align'
import {
  buildCalendarSsotHeroTripDisplays,
  departureIsoFromAlignedFacts,
  resolveHeroTripDates,
} from '@/lib/product-hero-dates'
import { extractIsoDate } from '@/lib/hero-date-utils'
import { computeReturnDate, getProductTotalDays } from '@/lib/package-rules'

const prisma = new PrismaClient()

function returnIsoFromFacts(facts: DepartureKeyFacts | null): string | null {
  if (!facts?.inbound) return null
  return (
    extractIsoDate(facts.inbound.arrivalAtText) ??
    extractIsoDate(facts.inbound.departureAtText) ??
    null
  )
}

async function main() {
  const products = await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: {
      id: true,
      title: true,
      originSource: true,
      duration: true,
      departures: {
        select: {
          id: true,
          departureDate: true,
          outboundDepartureAt: true,
          outboundArrivalAt: true,
          outboundFlightNo: true,
          inboundDepartureAt: true,
          inboundArrivalAt: true,
          inboundFlightNo: true,
          carrierName: true,
        },
      },
      prices: { select: { id: true, date: true }, take: 5, orderBy: { date: 'asc' } },
    },
    take: 500,
  })

  let mismatchCount = 0
  for (const p of products) {
    for (const dep of p.departures) {
      const dateKey =
        dep.departureDate instanceof Date
          ? dep.departureDate.toISOString().slice(0, 10)
          : String(dep.departureDate).slice(0, 10)
      const facts = productDepartureToKeyFacts(dep as never)
      if (!facts?.outbound?.departureAtText) continue

      const packageTotalDays = getProductTotalDays({ duration: p.duration })
      const aligned = alignDepartureKeyFactsToSelectedCalendarDate(facts, dateKey, { packageTotalDays })
      const factsDep = departureIsoFromAlignedFacts(aligned)
      const factsRet = returnIsoFromFacts(aligned)
      if (!factsDep) continue

      const heroResolved = resolveHeroTripDates({
        originSource: p.originSource,
        selectedDate: dateKey,
        fallbackPriceRowDate: dateKey,
        duration: p.duration,
        departureFacts: aligned,
      })
      const computedReturn = computeReturnDate(dateKey, packageTotalDays)
      const { departureDisplay, returnDisplay } = buildCalendarSsotHeroTripDisplays({
        selectedDate: dateKey,
        packageTotalDays,
        heroResolved,
        computedReturnDate: computedReturn,
        departureFacts: aligned,
      })

      const depIsoFromDisplay = extractIsoDate(departureDisplay ?? '')
      const retIsoFromDisplay = extractIsoDate(returnDisplay ?? '')

      const depMismatch = depIsoFromDisplay && factsDep && depIsoFromDisplay !== factsDep
      const retMismatch = retIsoFromDisplay && factsRet && retIsoFromDisplay !== factsRet
      const inverted = depIsoFromDisplay && retIsoFromDisplay && depIsoFromDisplay > retIsoFromDisplay

      if (depMismatch || retMismatch || inverted) {
        mismatchCount++
        console.log(
          JSON.stringify({
            productId: p.id,
            title: p.title.slice(0, 60),
            departureDateKey: dateKey,
            factsDep,
            factsRet,
            departureDisplay,
            returnDisplay,
            depMismatch,
            retMismatch,
            inverted,
          }),
        )
      }
    }
  }

  console.log(JSON.stringify({ scannedProducts: products.length, mismatchDepartures: mismatchCount }))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
