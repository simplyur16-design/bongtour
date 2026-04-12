/**
 * register-admin 공용 저장 레이어 최소 E2E (HTTP·공급사 parse 미사용).
 * 성공/실패 DB 상태·retentionExpiresAt 확인용.
 *
 * 이 스크립트의 `brandKey` / `originSource` 값 **`e2e`**는 **테스트 전용 마커**이며, API canonical 공급사 키가 아니다.
 */
import { prisma } from '../lib/prisma'
import {
  createRegisterAnalysisRunningRow,
  createRegisterRawSnapshotRow,
  markRegisterAnalysisFailed,
  markRegisterAnalysisNormalized,
  markRegisterAnalysisPendingSaved,
} from '../lib/register-admin-analysis-store-hanatour'
import { REGISTER_ADMIN_SNAPSHOT_STATUS } from '../lib/register-admin-audit-status-hanatour'

const stamp = `e2e-${Date.now()}`

async function main() {
  const failSnap = await createRegisterRawSnapshotRow({
    prisma,
    brandKey: 'e2e',
    originSource: 'e2e',
    originUrl: null,
    originCodeHint: null,
    bodyText: 'fail body',
    pastedBlocksJson: null,
    inputDigest: `digest-fail-${stamp}`,
    travelScope: 'overseas',
    requestMode: 'preview',
  })
  const failAttempt = await createRegisterAnalysisRunningRow({
    prisma,
    snapshotId: failSnap.id,
    attemptNo: 1,
  })
  await markRegisterAnalysisFailed({
    prisma,
    analysisId: failAttempt.id,
    snapshotId: failSnap.id,
    err: {
      parseErrorMessage: 'e2e synthetic fail',
      firstPassLlmRaw: '',
      repairLlmRaw: null,
      repairAttempted: false,
      finishReason: null,
      repairFinishReason: null,
    },
  })
  const failSnapRow = await prisma.registerAdminInputSnapshot.findUnique({ where: { id: failSnap.id } })
  const failAnRow = await prisma.registerAdminAnalysis.findUnique({ where: { id: failAttempt.id } })

  const okSnap = await createRegisterRawSnapshotRow({
    prisma,
    brandKey: 'e2e',
    originSource: 'e2e',
    originUrl: null,
    originCodeHint: null,
    bodyText: 'ok body',
    pastedBlocksJson: null,
    inputDigest: `digest-ok-${stamp}`,
    travelScope: 'overseas',
    requestMode: 'confirm',
  })
  const okAttempt = await createRegisterAnalysisRunningRow({
    prisma,
    snapshotId: okSnap.id,
    attemptNo: 1,
  })
  await markRegisterAnalysisNormalized({
    prisma,
    analysisId: okAttempt.id,
    snapshotId: okSnap.id,
    snapshotStatus: REGISTER_ADMIN_SNAPSHOT_STATUS.normalized_ready,
    data: {
      llmFinishReason: null,
      repairAttempted: false,
      repairFinishReason: null,
      parsedJson: null,
      normalizedJson: '{"title":"e2e"}',
      extractionIssuesJson: '[]',
      reviewState: 'clean',
      originCodeResolved: `OC-${stamp}`,
    },
  })
  const product = await prisma.product.create({
    data: {
      originSource: 'e2e',
      originCode: `OC-${stamp}`,
      title: 'e2e retention product',
    },
  })
  await markRegisterAnalysisPendingSaved({
    prisma,
    analysisId: okAttempt.id,
    snapshotId: okSnap.id,
    productId: product.id,
  })
  const okSnapRow = await prisma.registerAdminInputSnapshot.findUnique({ where: { id: okSnap.id } })
  const okAnRow = await prisma.registerAdminAnalysis.findUnique({ where: { id: okAttempt.id } })

  console.log(
    JSON.stringify(
      {
        fail: {
          snapshotId: failSnap.id,
          snapshotStatus: failSnapRow?.status,
          snapshotRetentionIso: failSnapRow?.retentionExpiresAt?.toISOString() ?? null,
          analysisStatus: failAnRow?.status,
        },
        ok: {
          snapshotId: okSnap.id,
          snapshotStatus: okSnapRow?.status,
          snapshotRetentionIso: okSnapRow?.retentionExpiresAt?.toISOString() ?? null,
          analysisStatus: okAnRow?.status,
          productId: okAnRow?.productId,
        },
      },
      null,
      2
    )
  )

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  try {
    await prisma.$disconnect()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
