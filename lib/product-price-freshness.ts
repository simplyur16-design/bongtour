/**
 * D-4: 공급사 가격 관측 시각·자동 비공개(180일)·freshness 라벨.
 *
 * SSOT: `ProductPrice`에는 동기 시각 컬럼 없음(`date`=출발일만). `ProductDeparture`는 `syncedAt`이 동기화 시각(`createdAt` 없음).
 */
import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'

import { createSolapiAuthorizationHeader } from '@/lib/solapi-auth'
import { resolveSolapiOperatorRecipient } from '@/lib/bong-marketing/publish-reminder'

const THROTTLE_MS = 5 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const LMS_TEXT_MAX = 1900
const SOLAPI_SEND_URL = 'https://api.solapi.com/messages/v4/send'

export type PriceFreshnessLabel = 'fresh_7d' | 'stale_30d' | 'stale_90d' | 'archive_pending' | 'unknown'

export function isPriceFreshnessDryRun(): boolean {
  const v = (process.env.PRICE_FRESHNESS_DRY_RUN ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function digitsOnlyPhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

function isPlausibleKrSmsTo(digits: string): boolean {
  const n = digits.length
  return n >= 10 && n <= 12
}

async function sendSolapiLms(toDigits: string, text: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const apiKey = process.env.SOLAPI_API_KEY?.trim()
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim()
  const senderRaw = process.env.SOLAPI_FROM_PHONE?.trim()
  if (!apiKey || !apiSecret || !senderRaw) {
    return { ok: false, message: 'solapi_credentials_missing' }
  }
  const from = digitsOnlyPhone(senderRaw)
  if (!from || !isPlausibleKrSmsTo(from)) {
    return { ok: false, message: 'solapi_invalid_from_phone' }
  }
  const authHeader = createSolapiAuthorizationHeader(apiKey, apiSecret)
  const bodyText = text.length > LMS_TEXT_MAX ? `${text.slice(0, LMS_TEXT_MAX - 1)}…` : text
  const res = await fetch(SOLAPI_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      message: {
        from,
        to: toDigits,
        text: bodyText,
      },
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    statusCode?: string
    errorCode?: string
    statusMessage?: string
    message?: string
  }
  if (!res.ok) {
    const message = data.statusMessage ?? data.message ?? res.statusText
    return { ok: false, message }
  }
  return { ok: true }
}

/**
 * ProductPrice / ProductDeparture 반영 직후 호출. 5분 이내 재호출은 UPDATE 생략.
 */
export async function updateLastPriceObservedAt(prisma: PrismaClient, productId: string): Promise<void> {
  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: { lastPriceObservedAt: true },
  })
  const last = row?.lastPriceObservedAt
  if (last != null && Date.now() - last.getTime() < THROTTLE_MS) return
  await prisma.product.update({
    where: { id: productId },
    data: { lastPriceObservedAt: new Date() },
  })
}

/**
 * @param productCreatedAtFallback `lastPriceObservedAt` 이 비었을 때만 라벨 폴백용 — **`Product.createdAt`** (자식 테이블 createdAt 아님).
 */
export function priceFreshnessLabel(
  lastPriceObservedAt: Date | null,
  productCreatedAtFallback: Date,
  now: Date = new Date()
): PriceFreshnessLabel {
  const ageMs = (from: Date) => Math.max(0, now.getTime() - from.getTime())
  const d7 = 7 * DAY_MS
  const d30 = 30 * DAY_MS
  const d90 = 90 * DAY_MS
  const d180 = 180 * DAY_MS

  if (lastPriceObservedAt != null) {
    const age = ageMs(lastPriceObservedAt)
    if (age <= d7) return 'fresh_7d'
    if (age <= d30) return 'stale_30d'
    if (age <= d90) return 'stale_90d'
    return 'archive_pending'
  }

  const createdAge = ageMs(productCreatedAtFallback)
  if (createdAge <= d180) return 'unknown'
  return 'archive_pending'
}

/**
 * 등록 상품 중 180일 가격 미관측(auto_unpublish) 후보 ID.
 * `lastPriceObservedAt` 이 비었을 때는 `MAX(ProductDeparture.syncedAt)` (성인가 있는 행만) 후 `Product.createdAt` COALESCE.
 */
export async function findAutoUnpublishPriceStaleProductIds(
  prisma: PrismaClient,
  cutoff: Date = new Date(Date.now() - 180 * DAY_MS)
): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT p.id
    FROM "Product" p
    WHERE p."registrationStatus" = 'registered'
    AND (
      (p."lastPriceObservedAt" IS NOT NULL AND p."lastPriceObservedAt" < ${cutoff})
      OR (
        p."lastPriceObservedAt" IS NULL
        AND COALESCE(
          (
            SELECT MAX(d."syncedAt")
            FROM "ProductDeparture" d
            WHERE d."productId" = p.id
              AND d."adultPrice" IS NOT NULL
          ),
          p."createdAt"
        ) < ${cutoff}
      )
    )
  `)
  return rows.map((r) => r.id)
}

export type AutoUnpublishStaleProductsResult = {
  candidateIds: string[]
  updatedCount: number
  dryRun: boolean
  notifyAttempted: boolean
  notifyOk: boolean
  notifyMessage?: string
}

/**
 * 등록된 상품 중 가격 관측이 180일 지난 경우 auto_unpublished 처리 + 운영자 LMS(드라이런 시 생략).
 */
export async function autoUnpublishStaleProducts(
  prisma: PrismaClient,
  opts?: { dryRun?: boolean }
): Promise<AutoUnpublishStaleProductsResult> {
  const dryRun = opts?.dryRun ?? isPriceFreshnessDryRun()
  const cutoff = new Date(Date.now() - 180 * DAY_MS)

  const candidateIds = await findAutoUnpublishPriceStaleProductIds(prisma, cutoff)

  if (candidateIds.length === 0) {
    return { candidateIds: [], updatedCount: 0, dryRun, notifyAttempted: false, notifyOk: false }
  }

  if (dryRun) {
    console.log(
      '[price-freshness] DRY_RUN: would auto_unpublish',
      candidateIds.length,
      'ids:',
      candidateIds.join(',')
    )
    return {
      candidateIds,
      updatedCount: 0,
      dryRun: true,
      notifyAttempted: false,
      notifyOk: false,
      notifyMessage: 'dry_run',
    }
  }

  const ur = await prisma.product.updateMany({
    where: { id: { in: candidateIds } },
    data: {
      registrationStatus: 'auto_unpublished',
      autoUnpublishedAt: new Date(),
      autoUnpublishedReason: 'no_price_180d',
    },
  })

  const to = resolveSolapiOperatorRecipient()
  let notifyAttempted = false
  let notifyOk = false
  let notifyMessage: string | undefined

  if (!to) {
    notifyMessage = 'no_operator_recipient'
    console.warn('[price-freshness] Solapi skipped: no SOLAPI_OPERATOR_PHONE / SOLAPI_ADMIN_PHONES')
  } else {
    notifyAttempted = true
    const head = `[봉투어] 가격 미관측 180일 자동 비공개 ${candidateIds.length}건 (no_price_180d)\n`
    const rest = candidateIds.join(',')
    const body = head + rest
    const send = await sendSolapiLms(digitsOnlyPhone(to), body)
    notifyOk = send.ok
    notifyMessage = send.ok ? undefined : 'message' in send ? send.message : 'send_failed'
    if (!send.ok) {
      console.warn('[price-freshness] Solapi LMS failed', notifyMessage)
    }
  }

  return {
    candidateIds,
    updatedCount: ur.count,
    dryRun: false,
    notifyAttempted,
    notifyOk,
    notifyMessage,
  }
}
