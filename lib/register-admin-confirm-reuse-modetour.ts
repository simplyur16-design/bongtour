/** [modetour] register-admin-confirm-reuse */
/**
 * confirm 시 preview에서 저장된 분석 행을 재사용해 main parseFn(LLM) 재호출을 생략한다.
 * registerSnapshotId + registerAnalysisId + 입력 digest 일치가 신뢰 경계.
 */
import { prisma } from '@/lib/prisma'
import { computeRegisterInputDigestFromBody } from '@/lib/register-admin-input-digest-modetour'
import { REGISTER_ADMIN_ANALYSIS_STATUS } from '@/lib/register-admin-audit-status-modetour'
import { stripRegisterInternalArtifacts, type RegisterParsed } from '@/lib/register-llm-schema-modetour'

export async function tryLoadRegisterParsedForConfirmReuse(params: {
  snapshotId: string
  analysisId: string
  body: Record<string, unknown>
  forcedBrandKey: string | null
}): Promise<RegisterParsed | null> {
  const sid = params.snapshotId.trim()
  const aid = params.analysisId.trim()
  if (!sid || !aid) return null

  const digest = computeRegisterInputDigestFromBody(params.body, params.forcedBrandKey)
  const snap = await prisma.registerAdminInputSnapshot.findFirst({
    where: { id: sid, inputDigest: digest },
    select: { id: true },
  })
  if (!snap) return null

  const row = await prisma.registerAdminAnalysis.findFirst({
    where: {
      id: aid,
      snapshotId: sid,
      status: {
        in: [
          REGISTER_ADMIN_ANALYSIS_STATUS.normalized_ready,
          REGISTER_ADMIN_ANALYSIS_STATUS.parsed,
        ],
      },
    },
    select: { normalizedJson: true, parsedJson: true },
  })
  if (!row) return null

  const raw = (row.normalizedJson?.trim() || row.parsedJson?.trim()) ?? ''
  if (!raw) return null

  try {
    const obj = JSON.parse(raw) as RegisterParsed
    if (!obj?.originCode || String(obj.originCode).trim() === '' || obj.originCode === '미지정') return null
    return stripRegisterInternalArtifacts(obj)
  } catch {
    return null
  }
}
