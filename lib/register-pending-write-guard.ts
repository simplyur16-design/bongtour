/**
 * pending / pre_photo_blocked 전용 일정·rawMeta 쓰기 가드.
 * - 재수집 중 registered 전환 race: transaction 내 status reread + updateMany count===1
 * - 다중 인스턴스(GHA+서버): schedule optimistic lock (in-memory healJobRunning은 단일 프로세스만)
 * REGRESSION-FREEZE[register-pending-write-guard-1106]: pending-only write + revision stale — manifest
 */
import { prisma } from '@/lib/prisma'
import { REGISTER_PRE_PHOTO_BLOCKED_STATUS } from '@/lib/register-pre-photo-pending-queue'
import { isScheduleSupplierOriginalLocked } from '@/lib/schedule-supplier-original-lock'

export {
  RAW_META_MATERIALIZED_REVISION_KEY,
  RAW_META_LAST_REVIEWED_HASH_KEY,
  computeMaterializedRevision,
  parseProductRawMeta,
  readMaterializedRevision,
  readLastReviewedHash,
  isReviewRevisionStale,
  stampRematRevisionOnRawMeta,
} from '@/lib/register-pending-revision'

export const PENDING_HEAL_WRITE_STATUSES = ['pending', REGISTER_PRE_PHOTO_BLOCKED_STATUS] as const

export type PendingOnlyWriteAbortReason =
  | 'aborted_missing'
  | 'aborted_status'
  | 'aborted_lock'
  | 'aborted_concurrent'

export type PendingOnlyWriteResult =
  | { ok: true; count: 1 }
  | { ok: false; reason: PendingOnlyWriteAbortReason; count: 0 }

/**
 * transaction: status/lock reread → updateMany(status∈pending|blocked [+ schedule optimistic]) → count===1만 성공.
 * count 0이면 쓰기·upstream 사진 진행 금지.
 */
export async function commitPendingOnlyProductScheduleWrite(args: {
  productId: string
  expectedSchedule: string | null | undefined
  nextSchedule: string
  nextRawMeta?: string | null
  prismaClient?: typeof prisma
}): Promise<PendingOnlyWriteResult> {
  const db = args.prismaClient ?? prisma
  const productId = String(args.productId ?? '').trim()
  if (!productId) return { ok: false, reason: 'aborted_missing', count: 0 }

  return db.$transaction(async (tx) => {
    const row = await tx.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        registrationStatus: true,
        schedule: true,
        rawMeta: true,
      },
    })
    if (!row) return { ok: false as const, reason: 'aborted_missing' as const, count: 0 as const }

    const status = String(row.registrationStatus ?? '')
    if (status !== 'pending' && status !== REGISTER_PRE_PHOTO_BLOCKED_STATUS) {
      return { ok: false as const, reason: 'aborted_status' as const, count: 0 as const }
    }
    if (isScheduleSupplierOriginalLocked(row.rawMeta)) {
      return { ok: false as const, reason: 'aborted_lock' as const, count: 0 as const }
    }

    const where: {
      id: string
      registrationStatus: { in: string[] }
      schedule?: string | null
    } = {
      id: productId,
      registrationStatus: { in: [...PENDING_HEAL_WRITE_STATUSES] },
    }
    if (args.expectedSchedule !== undefined) {
      where.schedule = args.expectedSchedule == null ? null : String(args.expectedSchedule)
    }

    const data: { schedule: string; rawMeta?: string | null } = {
      schedule: args.nextSchedule,
    }
    if (args.nextRawMeta !== undefined) data.rawMeta = args.nextRawMeta

    const upd = await tx.product.updateMany({ where, data })
    if (upd.count !== 1) {
      return { ok: false as const, reason: 'aborted_concurrent' as const, count: 0 as const }
    }
    return { ok: true as const, count: 1 as const }
  })
}
