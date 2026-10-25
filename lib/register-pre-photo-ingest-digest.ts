/**
 * 야간 수집·힐 결과 다이제스트 SMS (건별 문자 금지, 밤 1통).
 * 프로세스 메모리 집계 + 기존 createdTonight 카운트. DB 스키마 추가 없음.
 */

import {
  getRegisterIngestEsimYieldSkipCount,
  isRegisterListingIngestCronEnabled,
} from '@/lib/register-listing-ingest-cron-gate'
import {
  resolveInstrumentationProcessRole,
  type InstrumentationProcessRole,
} from '@/lib/instrumentation-process-role'
import {
  enqueueOpsSms,
  getOpsSmsDailyCapDeferredCount,
  opsSmsKstDayKey,
  takeOpsSmsDailyCapDigestPrefix,
} from '@/lib/solapi-ops-sms-limiter'
import { REGISTER_PRE_PHOTO_BLOCKED_STATUS } from '@/lib/register-pre-photo-pending-queue'
import { addDaysUtcYmd } from '@/lib/calendar-ymd'

type Acc = {
  bySupplierCreated: Record<string, number>
  confirmFails: number
  discoverFails: number
  healProcessed: number
  partialMissing: boolean
  /** 모두투어 e2e modal defer 가 N회 넘은 상품 수(프로세스 메모리) */
  modetourE2eDeferHot: number
}

const acc: Acc = {
  bySupplierCreated: {},
  confirmFails: 0,
  discoverFails: 0,
  healProcessed: 0,
  partialMissing: false,
  modetourE2eDeferHot: 0,
}

let digestSentDayKey: string | null = null

export function recordRegisterPrePhotoIngestDigestFromJobResult(result: {
  ingest?: {
    created?: number
    failed?: number
    skippedNoListing?: string[]
    bySupplier?: Record<string, number>
  }
  heal?: { healed?: number; verified?: number; blocked?: number; failed?: number }
}): void {
  const ingest = result.ingest
  if (ingest?.bySupplier) {
    for (const [k, n] of Object.entries(ingest.bySupplier)) {
      acc.bySupplierCreated[k] = (acc.bySupplierCreated[k] ?? 0) + (Number(n) || 0)
    }
  }
  acc.confirmFails += Number(ingest?.failed) || 0
  // skippedNoListing 항목은 discover 실패/빈 목록 지표
  acc.discoverFails += Array.isArray(ingest?.skippedNoListing) ? ingest!.skippedNoListing!.length : 0
  const heal = result.heal
  if (heal) {
    acc.healProcessed +=
      (Number(heal.healed) || 0) +
      (Number(heal.verified) || 0) +
      (Number(heal.blocked) || 0) +
      (Number(heal.failed) || 0)
  }
}

export function markRegisterPrePhotoIngestDigestPartialMissing(): void {
  acc.partialMissing = true
}

/** 모두투어 연속 e2e defer 가 임계를 넘은 상품을 다이제스트에 반영 */
export function recordModetourE2eDeferHotForDigest(count = 1): void {
  acc.modetourE2eDeferHot += Math.max(0, Math.floor(count))
}

function isDigestSmsEnabled(): boolean {
  return process.env.REGISTER_INGEST_DIGEST_SMS !== '0'
}

/** KST 10:05 이후(창 종료 후)에만 다이제스트 발송 후보 */
export function isRegisterPrePhotoIngestDigestSendWindow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  // 10:05 포함 ~ 22:00 미만 (다음 밤 창 전)
  if (hour > 10 && hour < 22) return true
  if (hour === 10 && minute >= 5) return true
  return false
}

export function buildRegisterPrePhotoIngestDigestText(opts: {
  createdTonight: Record<string, number>
  photoKeywordBlocked: number | null
  yieldSkips: number
  opsDeferred: number
  dailyCapPrefix: string | null
}): string {
  const createdMerged: Record<string, number> = { ...acc.bySupplierCreated }
  for (const [k, n] of Object.entries(opts.createdTonight)) {
    createdMerged[k] = Math.max(createdMerged[k] ?? 0, Number(n) || 0)
  }
  const supplierParts = Object.keys(createdMerged)
    .sort()
    .map((k) => `${k}:${createdMerged[k] ?? 0}`)
  const lines = [
    '[ingest-digest]',
    `createdBySupplier ${supplierParts.join(' ') || 'none'}`,
    `confirmFail ${acc.confirmFails}`,
    `discoverFail ${acc.discoverFails}`,
    `esimYieldSkip ${opts.yieldSkips}`,
    `healProcessed ${acc.healProcessed}`,
    `photoKeywordBlocked ${opts.photoKeywordBlocked == null ? 'n/a' : opts.photoKeywordBlocked}`,
    `opsSmsDailyCapDeferred ${opts.opsDeferred}`,
    `modetourE2eDeferHot ${acc.modetourE2eDeferHot}`,
  ]
  if (opts.dailyCapPrefix) lines.push(opts.dailyCapPrefix)
  if (acc.partialMissing) lines.push('note: partial aggregation missing (process restart)')
  return lines.join('\n')
}

async function countPhotoKeywordBlockedPending(): Promise<number | null> {
  try {
    const { prisma } = await import('@/lib/prisma')
    return await prisma.product.count({
      where: {
        OR: [
          { registrationStatus: REGISTER_PRE_PHOTO_BLOCKED_STATUS },
          {
            registrationStatus: 'pending',
            OR: [{ bgImageUrl: null }, { bgImageUrl: '' }],
          },
        ],
      },
    })
  } catch {
    return null
  }
}

/**
 * worker 전용, ENABLE=1 일 때만, 하루 1통.
 * REGISTER_INGEST_DIGEST_SMS=0 이면 끔.
 */
export async function maybeSendRegisterPrePhotoIngestDigest(opts?: {
  role?: InstrumentationProcessRole
  now?: Date
  forceWindowId?: string
}): Promise<{ sent: boolean; reason?: string }> {
  if (!isDigestSmsEnabled()) return { sent: false, reason: 'digest-disabled' }
  if (!isRegisterListingIngestCronEnabled()) return { sent: false, reason: 'ingest-off' }
  const role = opts?.role ?? resolveInstrumentationProcessRole()
  if (role !== 'worker' && role !== 'all') return { sent: false, reason: 'not-worker' }
  const now = opts?.now ?? new Date()
  if (!isRegisterPrePhotoIngestDigestSendWindow(now)) return { sent: false, reason: 'outside-window' }

  const dayKey = opsSmsKstDayKey(now.getTime())
  if (digestSentDayKey === dayKey) return { sent: false, reason: 'already-sent' }

  let createdTonight: Record<string, number> = {}
  try {
    const { countRegisterPrePhotoIngestCreatedTonight } = await import(
      '@/lib/register-pre-photo-ingest-night-progress'
    )
    // 창이 끝난 뒤(10:05~)에는 직전 밤 windowId = 어제(KST) 저녁 날짜
    const todayKst = opsSmsKstDayKey(now.getTime())
    const windowId = opts?.forceWindowId ?? addDaysUtcYmd(todayKst, -1)
    createdTonight = await countRegisterPrePhotoIngestCreatedTonight(windowId)
  } catch {
    acc.partialMissing = true
  }

  const photoKeywordBlocked = await countPhotoKeywordBlockedPending()
  const yieldSkips = getRegisterIngestEsimYieldSkipCount()
  const opsDeferred = getOpsSmsDailyCapDeferredCount()
  const dailyCapPrefix = takeOpsSmsDailyCapDigestPrefix()
  const text = buildRegisterPrePhotoIngestDigestText({
    createdTonight,
    photoKeywordBlocked,
    yieldSkips,
    opsDeferred,
    dailyCapPrefix,
  })

  // URL·전화번호 패턴이 들어가면 안 됨 (테스트에서도 검증)
  const r = await enqueueOpsSms({ kind: 'ingest-digest', text })
  digestSentDayKey = dayKey
  return { sent: r.sent || r.dryRun || r.queued || r.deferred, reason: r.reason }
}

export function __resetRegisterPrePhotoIngestDigestForTest(): void {
  acc.bySupplierCreated = {}
  acc.confirmFails = 0
  acc.discoverFails = 0
  acc.healProcessed = 0
  acc.partialMissing = false
  acc.modetourE2eDeferHot = 0
  digestSentDayKey = null
}

export function __ingestDigestAccForTest(): Acc {
  return { ...acc, bySupplierCreated: { ...acc.bySupplierCreated } }
}
