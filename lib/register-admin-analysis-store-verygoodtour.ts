/** [verygoodtour] register-admin-analysis-store */
import type { PrismaClient } from '../prisma-gen-runtime'
import {
  REGISTER_ADMIN_ANALYSIS_STATUS,
  REGISTER_ADMIN_SNAPSHOT_STATUS,
} from '@/lib/register-admin-audit-status-verygoodtour'
import {
  laterOf,
  retentionExpiresAtAnalysisFailed,
  retentionExpiresAtAnalysisRunning,
  retentionExpiresAtForSnapshotStatus,
  retentionExpiresAtNewSnapshot,
  retentionExpiresAtPendingSaved,
} from '@/lib/register-admin-retention-verygoodtour'

const DEFAULT_MAX = 1_500_000

function readMaxStoreCharsEnv(): number {
  const raw =
    process.env.REGISTER_ADMIN_STORE_MAX_CHARS?.trim() ??
    process.env.REGISTER_PIPELINE_MAX_STORE_CHARS?.trim()
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX
}

export function clipRegisterAdminDbText(s: string | null | undefined): string | null {
  if (s == null || s === '') return null
  const max = readMaxStoreCharsEnv()
  if (s.length <= max) return s
  return `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]`
}

const DEFAULT_BODY_MAX = 1_200_000

function readMaxBodyCharsEnv(): number {
  const raw =
    process.env.REGISTER_ADMIN_BODY_MAX_CHARS?.trim() ??
    process.env.REGISTER_PIPELINE_MAX_BODY_CHARS?.trim()
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BODY_MAX
}

export function clipRegisterAdminBodyText(s: string): string {
  const max = readMaxBodyCharsEnv()
  if (s.length <= max) return s
  return `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]`
}

/** 스냅샷 만료 시각을 최소 minExpiresAt 이상으로 연장(null이면 설정) */
export async function touchRegisterAdminSnapshotRetentionAtLeast(params: {
  prisma: PrismaClient
  snapshotId: string
  minExpiresAt: Date
}): Promise<void> {
  const row = await params.prisma.registerAdminInputSnapshot.findUnique({
    where: { id: params.snapshotId },
    select: { retentionExpiresAt: true },
  })
  if (!row) return
  const next =
    row.retentionExpiresAt == null ? params.minExpiresAt : laterOf(row.retentionExpiresAt, params.minExpiresAt)
  await params.prisma.registerAdminInputSnapshot.update({
    where: { id: params.snapshotId },
    data: { retentionExpiresAt: next },
  })
}

export async function createRegisterRawSnapshotRow(params: {
  prisma: PrismaClient
  brandKey: string | null
  originSource: string
  originUrl: string | null
  originCodeHint: string | null
  bodyText: string
  pastedBlocksJson: string | null
  inputDigest: string
  travelScope: string
  requestMode: 'preview' | 'confirm'
}): Promise<{ id: string }> {
  return params.prisma.registerAdminInputSnapshot.create({
    data: {
      brandKey: params.brandKey,
      originSource: params.originSource,
      originUrl: params.originUrl,
      originCode: params.originCodeHint,
      bodyText: clipRegisterAdminBodyText(params.bodyText),
      pastedBlocksJson: params.pastedBlocksJson,
      inputDigest: params.inputDigest,
      travelScope: params.travelScope || null,
      requestMode: params.requestMode,
      status: REGISTER_ADMIN_SNAPSHOT_STATUS.raw_saved,
      retentionExpiresAt: retentionExpiresAtNewSnapshot(),
    },
    select: { id: true },
  })
}

export async function nextRegisterAnalysisAttemptNo(prisma: PrismaClient, snapshotId: string): Promise<number> {
  const c = await prisma.registerAdminAnalysis.count({ where: { snapshotId } })
  return c + 1
}

export async function createRegisterAnalysisRunningRow(params: {
  prisma: PrismaClient
  snapshotId: string
  attemptNo: number
}): Promise<{ id: string }> {
  const row = await params.prisma.registerAdminAnalysis.create({
    data: {
      snapshotId: params.snapshotId,
      attemptNo: params.attemptNo,
      status: REGISTER_ADMIN_ANALYSIS_STATUS.analysis_running,
    },
    select: { id: true },
  })
  await touchRegisterAdminSnapshotRetentionAtLeast({
    prisma: params.prisma,
    snapshotId: params.snapshotId,
    minExpiresAt: retentionExpiresAtAnalysisRunning(),
  })
  return row
}

export async function markRegisterAnalysisFailed(params: {
  prisma: PrismaClient
  analysisId: string
  snapshotId: string
  err: {
    parseErrorMessage: string
    firstPassLlmRaw: string
    repairLlmRaw: string | null
    repairAttempted: boolean
    finishReason: string | null
    repairFinishReason: string | null
  }
}): Promise<void> {
  await params.prisma.registerAdminAnalysis.update({
    where: { id: params.analysisId },
    data: {
      status: REGISTER_ADMIN_ANALYSIS_STATUS.analysis_failed,
      parseErrorMessage: params.err.parseErrorMessage.slice(0, 8000),
      llmRawFirstPass: clipRegisterAdminDbText(params.err.firstPassLlmRaw),
      llmRawRepair: clipRegisterAdminDbText(params.err.repairLlmRaw),
      repairAttempted: params.err.repairAttempted,
      llmFinishReason: params.err.finishReason,
      repairFinishReason: params.err.repairFinishReason,
    },
  })
  await params.prisma.registerAdminInputSnapshot.update({
    where: { id: params.snapshotId },
    data: {
      status: REGISTER_ADMIN_SNAPSHOT_STATUS.analysis_failed,
      retentionExpiresAt: retentionExpiresAtAnalysisFailed(),
    },
  })
}

export async function markRegisterAnalysisNormalized(params: {
  prisma: PrismaClient
  analysisId: string
  snapshotId: string
  snapshotStatus: (typeof REGISTER_ADMIN_SNAPSHOT_STATUS)[keyof typeof REGISTER_ADMIN_SNAPSHOT_STATUS]
  data: {
    llmFinishReason: string | null
    repairAttempted: boolean
    repairFinishReason: string | null
    parsedJson: string | null
    normalizedJson: string
    extractionIssuesJson: string | null
    reviewState: string | null
    originCodeResolved: string
  }
}): Promise<void> {
  await params.prisma.registerAdminAnalysis.update({
    where: { id: params.analysisId },
    data: {
      status:
        params.snapshotStatus === REGISTER_ADMIN_SNAPSHOT_STATUS.review_required
          ? REGISTER_ADMIN_ANALYSIS_STATUS.review_required
          : REGISTER_ADMIN_ANALYSIS_STATUS.normalized_ready,
      llmFinishReason: params.data.llmFinishReason,
      repairAttempted: params.data.repairAttempted,
      repairFinishReason: params.data.repairFinishReason,
      parsedJson: params.data.parsedJson ? clipRegisterAdminDbText(params.data.parsedJson) : null,
      normalizedJson: clipRegisterAdminDbText(params.data.normalizedJson),
      extractionIssuesJson: params.data.extractionIssuesJson
        ? clipRegisterAdminDbText(params.data.extractionIssuesJson)
        : null,
      reviewState: params.data.reviewState,
      originCodeResolved: params.data.originCodeResolved,
    },
  })
  await params.prisma.registerAdminInputSnapshot.update({
    where: { id: params.snapshotId },
    data: {
      status: params.snapshotStatus,
      originCode: params.data.originCodeResolved,
      retentionExpiresAt: retentionExpiresAtForSnapshotStatus(params.snapshotStatus),
    },
  })
}

export async function markRegisterAnalysisPendingSaved(params: {
  prisma: PrismaClient
  analysisId: string | null
  snapshotId: string | null
  productId: string
}): Promise<void> {
  if (params.analysisId) {
    await params.prisma.registerAdminAnalysis.update({
      where: { id: params.analysisId },
      data: {
        status: REGISTER_ADMIN_ANALYSIS_STATUS.pending_saved,
        productId: params.productId,
      },
    })
  }
  if (params.snapshotId) {
    await params.prisma.registerAdminInputSnapshot.update({
      where: { id: params.snapshotId },
      data: {
        status: REGISTER_ADMIN_SNAPSHOT_STATUS.pending_saved,
        retentionExpiresAt: retentionExpiresAtPendingSaved(),
      },
    })
  }
}

export async function recordTrustedNormalizedAnalysis(params: {
  prisma: PrismaClient
  snapshotId: string
  attemptNo: number
  normalizedJson: string
  extractionIssuesJson: string | null
  originCodeResolved: string
  reviewState: string | null
  snapshotStatus: (typeof REGISTER_ADMIN_SNAPSHOT_STATUS)[keyof typeof REGISTER_ADMIN_SNAPSHOT_STATUS]
}): Promise<{ id: string }> {
  const row = await params.prisma.registerAdminAnalysis.create({
    data: {
      snapshotId: params.snapshotId,
      attemptNo: params.attemptNo,
      status:
        params.snapshotStatus === REGISTER_ADMIN_SNAPSHOT_STATUS.review_required
          ? REGISTER_ADMIN_ANALYSIS_STATUS.review_required
          : REGISTER_ADMIN_ANALYSIS_STATUS.normalized_ready,
      normalizedJson: clipRegisterAdminDbText(params.normalizedJson),
      extractionIssuesJson: params.extractionIssuesJson
        ? clipRegisterAdminDbText(params.extractionIssuesJson)
        : null,
      originCodeResolved: params.originCodeResolved,
      reviewState: params.reviewState,
    },
    select: { id: true },
  })
  await params.prisma.registerAdminInputSnapshot.update({
    where: { id: params.snapshotId },
    data: {
      status: params.snapshotStatus,
      originCode: params.originCodeResolved,
      retentionExpiresAt: retentionExpiresAtForSnapshotStatus(params.snapshotStatus),
    },
  })
  return row
}
