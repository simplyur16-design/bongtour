/** [hanatour] register-admin-input-persist */
/**
 * 관리자 등록 요청의 원문 스냅샷·분석 행 저장, 주입된 parseFn 호출 시 DB 반영만 담당.
 * 공급사별 분기·캘린더 정책은 호출하는 핸들러에 둔다.
 */
import { prisma } from '@/lib/prisma'
import {
  RegisterLlmParseError,
  stripRegisterInternalArtifacts,
  type RegisterLlmParseOptionsCommon,
  type RegisterParsed,
} from '@/lib/register-llm-schema-hanatour'
import { computeRegisterInputDigestFromBody, parseRegisterPastedBlocksPayload } from '@/lib/register-admin-input-digest-hanatour'
import {
  clipRegisterAdminDbText,
  createRegisterAnalysisRunningRow,
  createRegisterRawSnapshotRow,
  markRegisterAnalysisFailed,
  markRegisterAnalysisNormalized,
  markRegisterAnalysisPendingSaved,
  nextRegisterAnalysisAttemptNo,
  recordTrustedNormalizedAnalysis,
  touchRegisterAdminSnapshotRetentionAtLeast,
} from '@/lib/register-admin-analysis-store-hanatour'
import {
  laterOf,
  retentionExpiresAtAfterParsedPersist,
  retentionExpiresAtReuseTouch,
} from '@/lib/register-admin-retention-hanatour'
import {
  REGISTER_ADMIN_ANALYSIS_STATUS,
  type RegisterAdminSnapshotStatus,
} from '@/lib/register-admin-audit-status-hanatour'

type ParseFn = (
  rawText: string,
  originSource?: string,
  options?: RegisterLlmParseOptionsCommon
) => Promise<RegisterParsed>

/** 요청 본문의 registerSnapshotId 재사용 또는 신규 스냅샷 행 생성 */
export async function resolveOrCreateRegisterAdminInputSnapshot(params: {
  body: Record<string, unknown>
  forcedBrandKey: string | null
  brandKey: string | null
  originSource: string
  originUrl: string | null
  text: string
  travelScope: string
  mode: 'preview' | 'confirm'
  originCodeHint: string | null
  timing: { mark: (label: string) => void }
}): Promise<string> {
  const reuse = typeof params.body.registerSnapshotId === 'string' ? params.body.registerSnapshotId.trim() : ''
  if (reuse) {
    const ex = await prisma.registerAdminInputSnapshot.findUnique({
      where: { id: reuse },
      select: { id: true, retentionExpiresAt: true },
    })
    if (ex) {
      const touchAt = retentionExpiresAtReuseTouch()
      const nextRetention =
        ex.retentionExpiresAt == null ? touchAt : laterOf(ex.retentionExpiresAt, touchAt)
      await prisma.registerAdminInputSnapshot.update({
        where: { id: reuse },
        data: { requestMode: params.mode, retentionExpiresAt: nextRetention },
      })
      params.timing.mark('after-raw-save')
      return reuse
    }
  }
  const digest = computeRegisterInputDigestFromBody(params.body, params.forcedBrandKey)
  const pb = parseRegisterPastedBlocksPayload(params.body)
  const row = await createRegisterRawSnapshotRow({
    prisma,
    brandKey: params.brandKey ?? params.forcedBrandKey,
    originSource: params.originSource,
    originUrl: params.originUrl,
    originCodeHint: params.originCodeHint,
    bodyText: params.text,
    pastedBlocksJson: pb ? JSON.stringify(pb) : null,
    inputDigest: digest,
    travelScope: params.travelScope,
    requestMode: params.mode,
  })
  params.timing.mark('after-raw-save')
  return row.id
}

/**
 * 분석 시도 행을 만든 뒤 주입된 parseFn만 호출하고, 성공/실패에 따라 분석·스냅샷 상태를 갱신한다.
 */
export async function invokeRegisterParsePersistAnalysisAttempt(params: {
  snapshotId: string
  timing: { mark: (label: string) => void }
  parseFn: ParseFn
  text: string
  originSource: string
  brandKey: string | null
  originUrl: string | null
  pastedBlocks: RegisterLlmParseOptionsCommon['pastedBlocks']
  forPreview: boolean
  skipDetailSectionGeminiRepairs?: boolean
  maxDetailSectionRepairs?: number
  llmCallMetrics?: { mainLlm: number; repairLlm: number; sectionRepairLlm: number }
  onTiming?: (label: string) => void
}): Promise<
  | { ok: true; parsed: RegisterParsed; analysisId: string; attemptNo: number }
  | { ok: false; analysisId: string; error: RegisterLlmParseError }
> {
  const attemptNo = await nextRegisterAnalysisAttemptNo(prisma, params.snapshotId)
  const { id: analysisId } = await createRegisterAnalysisRunningRow({
    prisma,
    snapshotId: params.snapshotId,
    attemptNo,
  })
  params.timing.mark('after-analysis-status-save')
  try {
    const parsed = await params.parseFn(params.text, params.originSource, {
      originUrl: params.originUrl,
      pastedBodyForInference: params.text,
      pastedBlocks: params.pastedBlocks ?? undefined,
      forPreview: params.forPreview,
      skipDetailSectionGeminiRepairs: params.skipDetailSectionGeminiRepairs,
      maxDetailSectionRepairs: params.maxDetailSectionRepairs,
      llmCallMetrics: params.llmCallMetrics,
      onTiming: params.onTiming,
    })
    const audit = parsed.registerParseAudit
    await prisma.registerAdminAnalysis.update({
      where: { id: analysisId },
      data: {
        status: REGISTER_ADMIN_ANALYSIS_STATUS.parsed,
        parsedJson: clipRegisterAdminDbText(parsed.registerAdminPersistedLlmParsedJson ?? null),
        llmRawFirstPass: clipRegisterAdminDbText(audit?.firstPassLlmRaw ?? null),
        llmRawRepair: clipRegisterAdminDbText(audit?.repairLlmRaw ?? null),
        llmFinishReason: audit?.finishReasonFirstPass ?? null,
        repairAttempted: audit?.repairAttempted ?? false,
        repairFinishReason: audit?.repairFinishReason ?? null,
        originCodeResolved: parsed.originCode,
      },
    })
    await touchRegisterAdminSnapshotRetentionAtLeast({
      prisma,
      snapshotId: params.snapshotId,
      minExpiresAt: retentionExpiresAtAfterParsedPersist(),
    })
    params.timing.mark('after-parsed-persist')
    return { ok: true, parsed, analysisId, attemptNo }
  } catch (e) {
    if (RegisterLlmParseError.is(e)) {
      await markRegisterAnalysisFailed({
        prisma,
        analysisId,
        snapshotId: params.snapshotId,
        err: {
          parseErrorMessage: e.parseErrorMessage,
          firstPassLlmRaw: e.firstPassLlmRaw,
          repairLlmRaw: e.repairLlmRaw,
          repairAttempted: e.repairAttempted,
          finishReason: e.finishReason,
          repairFinishReason: e.repairFinishReason,
        },
      })
      params.timing.mark('after-analysis-failure-save')
      return { ok: false, analysisId, error: e }
    }
    await markRegisterAnalysisFailed({
      prisma,
      analysisId,
      snapshotId: params.snapshotId,
      err: {
        parseErrorMessage: e instanceof Error ? e.message : String(e),
        firstPassLlmRaw: '',
        repairLlmRaw: null,
        repairAttempted: false,
        finishReason: null,
        repairFinishReason: null,
      },
    })
    params.timing.mark('after-analysis-failure-save')
    throw e
  }
}

/** 핸들러가 결정한 스냅샷·검수 상태로 정규화 본문을 분석 행에 기록 */
export async function persistRegisterAnalysisNormalizedFromParsed(params: {
  snapshotId: string
  analysisId: string
  parsed: RegisterParsed
  combinedFieldIssues: unknown[]
  snapshotStatus: RegisterAdminSnapshotStatus
  reviewState: string | null
  timing: { mark: (label: string) => void }
}): Promise<void> {
  const stripped = stripRegisterInternalArtifacts(params.parsed)
  const audit = params.parsed.registerParseAudit
  await markRegisterAnalysisNormalized({
    prisma,
    analysisId: params.analysisId,
    snapshotId: params.snapshotId,
    snapshotStatus: params.snapshotStatus,
    data: {
      llmFinishReason: audit?.finishReasonFirstPass ?? null,
      repairAttempted: audit?.repairAttempted ?? false,
      repairFinishReason: audit?.repairFinishReason ?? null,
      parsedJson: params.parsed.registerAdminPersistedLlmParsedJson ?? null,
      normalizedJson: JSON.stringify(stripped),
      extractionIssuesJson: JSON.stringify(params.combinedFieldIssues),
      reviewState: params.reviewState,
      originCodeResolved: params.parsed.originCode,
    },
  })
  params.timing.mark('after-normalized-save')
}

/** 클라이언트가 넘긴 이미 파싱된 본문을 신뢰 구간으로 분석 행에 기록 */
export async function persistRegisterAnalysisTrustedClientParsedRecord(params: {
  snapshotId: string
  attemptNo: number
  parsed: RegisterParsed
  combinedFieldIssues: unknown[]
  snapshotStatus: RegisterAdminSnapshotStatus
  reviewState: string | null
  timing: { mark: (label: string) => void }
}): Promise<{ analysisId: string }> {
  const stripped = stripRegisterInternalArtifacts(params.parsed)
  const created = await recordTrustedNormalizedAnalysis({
    prisma,
    snapshotId: params.snapshotId,
    attemptNo: params.attemptNo,
    normalizedJson: JSON.stringify(stripped),
    extractionIssuesJson: JSON.stringify(params.combinedFieldIssues),
    originCodeResolved: params.parsed.originCode,
    reviewState: params.reviewState,
    snapshotStatus: params.snapshotStatus,
  })
  params.timing.mark('after-normalized-save')
  return { analysisId: created.id }
}

export async function markRegisterAdminAnalysisPendingSavedWithTiming(params: {
  analysisId: string | null
  snapshotId: string | null
  productId: string
  timing: { mark: (label: string) => void }
}): Promise<void> {
  await markRegisterAnalysisPendingSaved({
    prisma,
    analysisId: params.analysisId,
    snapshotId: params.snapshotId,
    productId: params.productId,
  })
  params.timing.mark('after-pending-state-save')
}
