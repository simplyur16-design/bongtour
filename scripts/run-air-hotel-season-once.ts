/**
 * 1회 검증: air-hotel 시즌 큐레이션 job (임시 — 커밋 X)
 *
 *   npx tsx scripts/run-air-hotel-season-once.ts --cycleId 2026-05
 */
function parseCycleIdArg(): string {
  const idx = process.argv.indexOf('--cycleId')
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]
  const eq = process.argv.find((a) => a.startsWith('--cycleId='))
  if (eq) return eq.slice('--cycleId='.length)
  return '2026-05'
}

async function main() {
  const { loadEnvConfig } = await import('@next/env')
  loadEnvConfig(process.cwd())

  const cycleId = parseCycleIdArg()
  const { runAirHotelSeasonCurationJob } = await import('@/lib/air-hotel-season-curation-job')
  const { prisma } = await import('@/lib/prisma')

  const result = await runAirHotelSeasonCurationJob({ cycleId })
  console.log('--- job result ---')
  console.log(JSON.stringify(result, null, 2))

  const row = await prisma.airHotelSeasonCuration.findUnique({
    where: { cycleId },
    select: {
      monthlyMessages: true,
      linkedProductIds: true,
      geminiResponse: true,
      updatedAt: true,
    },
  })
  console.log('--- db row ---')
  console.log(
    JSON.stringify(
      {
        cycleId,
        monthlyMessages: row?.monthlyMessages,
        linkedProductIds: row?.linkedProductIds,
        updatedAt: row?.updatedAt,
        geminiResponse: row?.geminiResponse,
        modelUsed:
          process.env.GEMINI_CURATION_MODEL ||
          process.env.GEMINI_SEASON_CURATION_MODEL ||
          process.env.GEMINI_MODEL ||
          'gemini-2.5-flash',
      },
      null,
      2,
    ),
  )
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
