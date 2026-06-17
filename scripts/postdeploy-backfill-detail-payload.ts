/**
 * 배포(release) 직후 — payload 없는 등록 상품만 배치 백필.
 *
 * Railway 등: Release Command → `npm run postdeploy:detail-payload`
 * (Build Command `npm run build` 에 넣지 말 것 — 빌드 단계는 DB 미접속·타임아웃 위험)
 *
 * 매 배포마다 최대 N건만 처리 → 상품 수가 많아도 배포가 멈추지 않음.
 * 전량 1회: `npm run db:backfill-detail-payload` (수동·프로덕션 DATABASE_URL)
 *
 * Railway 등 프로덕션: 환경변수는 플랫폼이 주입 — dotenv(devDependency) 사용 금지.
 * 로컬 수동 실행: `.env.local` 이 필요하면 `npm run db:backfill-detail-payload` 사용.
 */
async function main() {
  const {
    postdeployDetailPayloadBatchSize,
    shouldSkipPostdeployDetailPayloadBackfill,
  } = await import('../lib/detail-payload-postdeploy')

  if (shouldSkipPostdeployDetailPayloadBackfill()) {
    console.log('[postdeploy-detail-payload] skip (build phase, no DATABASE_URL, or SKIP_*=1)')
    return
  }

  const { prisma } = await import('../lib/prisma')
  const { rebuildProductPublicDetailPayload } = await import(
    '../lib/product-public-detail/persist-payload'
  )

  const batch = postdeployDetailPayloadBatchSize()
  const missing = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      publicDetailPayloadJson: null,
    },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    take: batch,
  })

  if (missing.length === 0) {
    console.log('[postdeploy-detail-payload] nothing to do (all registered products have payload)')
    await prisma.$disconnect()
    return
  }

  const remainingAfter = await prisma.product.count({
    where: {
      registrationStatus: 'registered',
      publicDetailPayloadJson: null,
    },
  })

  console.log(
    `[postdeploy-detail-payload] batch=${missing.length} (registered missing payload total≈${remainingAfter})`,
  )

  let ok = 0
  let fail = 0
  for (const { id } of missing) {
    try {
      const saved = await rebuildProductPublicDetailPayload(id)
      if (saved) ok++
      else console.log(`[postdeploy-detail-payload] skip ${id}`)
    } catch (e) {
      fail++
      console.error(`[postdeploy-detail-payload] fail ${id}`, e)
    }
  }

  const remaining = await prisma.product.count({
    where: {
      registrationStatus: 'registered',
      publicDetailPayloadJson: null,
    },
  })

  console.log(`[postdeploy-detail-payload] done ok=${ok} fail=${fail} remaining=${remaining}`)
  await prisma.$disconnect()

  // preDeploy 컨테이너에서 실행되므로 non-zero exit가 deploy 차단함.
  // backfill은 opportunistic — 실패는 로그로만 표시하고 deploy는 계속 진행.
  if (fail > 0) {
    console.warn(
      `[postdeploy-detail-payload] WARN: ${fail} products failed payload rebuild (deploy continues)`,
    )
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('[postdeploy-detail-payload] top-level error:', err)
  process.exit(0) // preDeploy 차단 방지
})
