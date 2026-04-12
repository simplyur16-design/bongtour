/**
 * 모두투어 출발 입력 수집 스모크. `originSource`에 `모두` 문자열을 포함하는 조건은 **기존 DB에 남은 한글 표기 행**을 잡기 위한 보조이며,
 * 신규 API 입력으로 한글 `originSource`를 권장하지 않는다(canonical `modetour`가 SSOT).
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import { prisma } from '../lib/prisma'
import { collectDepartureInputsForAdminRescrape } from '../lib/admin-departure-rescrape'

async function main() {
  const product = await prisma.product.findFirst({
    where: {
      OR: [{ originSource: { contains: '모두' } }, { originSource: { contains: 'modetour' } }],
      originUrl: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, originSource: true, originCode: true, originUrl: true, title: true },
  })
  if (!product) {
    console.log(JSON.stringify({ ok: false, error: 'modetour product not found' }, null, 2))
    return
  }
  const result = await collectDepartureInputsForAdminRescrape(prisma, {
    id: product.id,
    originSource: product.originSource ?? '',
    originCode: product.originCode ?? '',
    originUrl: product.originUrl ?? null,
  })
  console.log(
    JSON.stringify(
      {
        ok: true,
        product: { id: product.id, title: product.title, originUrl: product.originUrl },
        mode: result.mode,
        source: result.source,
        attemptedLive: result.attemptedLive,
        liveError: result.liveError ?? null,
        filledFields: result.filledFields,
        missingFields: result.missingFields,
        mappingStatus: result.mappingStatus,
        notes: result.notes ?? [],
        count: result.inputs.length,
        sample: result.inputs.slice(0, 5),
      },
      null,
      2
    )
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
