/**
 * 참좋은 출발 입력 수집 스모크. `originSource`에 `VERYGOODTOUR` 등 문자열을 포함하는 조건은 **DB에 저장된 표기**를 고르기 위한 것이다.
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import { prisma } from '../lib/prisma'
import { collectVerygoodDepartureInputs, getMasterCodeFromProCode } from '../lib/verygoodtour-departures'
import { upsertProductDepartures } from '../lib/upsert-product-departures-verygoodtour'

async function main() {
  const products = await prisma.product.findMany({
    where: {
      originSource: { contains: 'VERYGOODTOUR' },
      originUrl: { not: null },
    },
    select: {
      id: true,
      originSource: true,
      originCode: true,
      originUrl: true,
      supplierGroupId: true,
      title: true,
    },
    take: 2,
    orderBy: { updatedAt: 'desc' },
  })

  if (products.length === 0) {
    console.log(
      JSON.stringify(
        { ok: false, supplierKey: 'verygoodtour', message: 'no products matched the verification filter.' },
        null,
        2
      )
    )
    return
  }

  const report: unknown[] = []

  for (const p of products) {
    const before = await prisma.productDeparture.findMany({
      where: { productId: p.id },
      orderBy: { departureDate: 'asc' },
      select: {
        departureDate: true,
        adultPrice: true,
        statusRaw: true,
        minPax: true,
        carrierName: true,
        outboundFlightNo: true,
        meetingPointRaw: true,
      },
    })

    const parsed = await collectVerygoodDepartureInputs(p.originUrl!, { monthCount: 3 })
    await upsertProductDepartures(
      prisma,
      p.id,
      parsed.map((x) => x.input)
    )

    const after = await prisma.productDeparture.findMany({
      where: { productId: p.id },
      orderBy: { departureDate: 'asc' },
      select: {
        departureDate: true,
        adultPrice: true,
        statusRaw: true,
        seatsStatusRaw: true,
        minPax: true,
        isBookable: true,
        carrierName: true,
        outboundFlightNo: true,
        outboundDepartureAirport: true,
        outboundDepartureAt: true,
        outboundArrivalAirport: true,
        inboundArrivalAirport: true,
        inboundArrivalAt: true,
        meetingInfoRaw: true,
        meetingPointRaw: true,
        meetingTerminalRaw: true,
      },
    })

    const pro = p.originCode
    const master = getMasterCodeFromProCode(pro)
    const nullStats = {
      carrierNameNull: after.filter((x) => x.carrierName == null).length,
      outboundFlightNoNull: after.filter((x) => x.outboundFlightNo == null).length,
      meetingPointNull: after.filter((x) => x.meetingPointRaw == null).length,
    }

    report.push({
      product: {
        id: p.id,
        originSource: p.originSource,
        originCode: p.originCode,
        supplierGroupId: p.supplierGroupId,
        title: p.title,
      },
      relation: { proCode: pro, masterCode: master },
      parsedCount: parsed.length,
      rawSample: parsed.slice(0, 3).map((x) => x.raw),
      beforeCount: before.length,
      afterCount: after.length,
      nullStats,
      afterSample: after.slice(0, 5),
    })
  }

  console.log(JSON.stringify({ ok: true, report }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
