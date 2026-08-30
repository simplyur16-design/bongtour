/**
 * 등록대기(사진 수급 전) Product.schedule 셀프힐 + 레인별 검증 — Pexels/Gemini 호출 없음.
 * 힐이 등록 SSOT로 고친 뒤 검증 통과만 pending. 실패는 pre_photo_blocked.
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: pending 사진 생성 금지 — manifest
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 등록화면 레인으로 힐·검증 — manifest
 * REGRESSION-FREEZE[pending-approve-photos-ready]: 사진 완료 skip photosReady SSOT — manifest
 * REGRESSION-FREEZE[pre-photo-keyword-verify-before-photos]: 키워드가 나와도 검증 스탬프 — manifest
 * REGRESSION-FREEZE[register-pre-photo-parser-fix]: 검증 실패는 등록대기 금지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-pending-verify-gate]: pre_photo_blocked — manifest
 * REGRESSION-FREEZE[register-pre-photo-city-soft-dup-not-bleed]: dest 미지정은 제목에서만 추론 — manifest
 * REGRESSION-FREEZE[register-pre-photo-heal-prisma-retry]: pooler 끊김은 재시도 후 저장 — manifest
 */
import { prisma } from '@/lib/prisma'
import { withPrismaRetry } from '@/lib/prisma-retry'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { resolveRegisterAdminLane, type RegisterAdminLane } from '@/lib/register-admin-lane'
import { isRegisterPendingPhotosReady } from '@/lib/register-pending-photos-ready'
import {
  healRegisterPrePhotoSchedule,
  isObviouslyBrokenScheduleImageUrl,
  probeRegisterScheduleImageUrl,
  type RegisterPrePhotoHealNote,
} from '@/lib/register-pre-photo-self-heal'
import {
  inferRegisterPendingDestinationFromTitle,
  mergeRegisterPrePhotoStampIntoRawMeta,
  verifyRegisterPrePhoto,
} from '@/lib/register-pre-photo-verify'
import { isRegisterPrePhotoPlaceLikeDestination } from '@/lib/register-schedule-cross-continent-keyword-guard'
import {
  REGISTER_PRE_PHOTO_BLOCKED_STATUS,
  registrationStatusAfterPrePhotoVerify,
} from '@/lib/register-pre-photo-pending-queue'

export type HealPendingPrePhotoOpts = {
  limit?: number
  probeImageUrls?: boolean
  dryRun?: boolean
  productId?: string
}

export type HealPendingPrePhotoResult = {
  scanned: number
  healed: number
  verified: number
  verifyFailed: number
  blocked: number
  promoted: number
  skippedPhotosReady: number
  skippedUnchanged: number
  failed: number
  ingestPerGeo: 1
  ingestSkipped: 'listing_collect_not_in_this_job'
  notesSample: RegisterPrePhotoHealNote[]
  byLane: Record<RegisterAdminLane, number>
}

const GATEABLE_STATUSES = new Set(['', 'pending', REGISTER_PRE_PHOTO_BLOCKED_STATUS])

function parseScheduleRows(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : []
  } catch {
    return []
  }
}

export async function healPendingRegisterPrePhoto(
  opts?: HealPendingPrePhotoOpts,
): Promise<HealPendingPrePhotoResult> {
  const limit = Math.min(200, Math.max(1, Math.floor(opts?.limit ?? 80)))
  const probeImageUrls = opts?.probeImageUrls === true
  const dryRun = opts?.dryRun === true
  const notesSample: RegisterPrePhotoHealNote[] = []
  const byLane: Record<RegisterAdminLane, number> = {
    package: 0,
    air_hotel_free: 0,
    theme: 0,
  }

  const products = await prisma.product.findMany({
    where: opts?.productId
      ? { id: opts.productId }
      : {
          OR: [
            { registrationStatus: null },
            { registrationStatus: '' },
            { registrationStatus: 'pending' },
            { registrationStatus: REGISTER_PRE_PHOTO_BLOCKED_STATUS },
          ],
        },
    orderBy: { updatedAt: 'asc' },
    take: opts?.productId ? 1 : limit,
    select: {
      id: true,
      title: true,
      destination: true,
      originSource: true,
      schedule: true,
      bgImageUrl: true,
      listingKind: true,
      productType: true,
      sportsThemeTag: true,
      rawMeta: true,
      registrationStatus: true,
      brand: { select: { brandKey: true } },
    },
  })

  let healed = 0
  let verified = 0
  let verifyFailed = 0
  let blocked = 0
  let promoted = 0
  let skippedPhotosReady = 0
  let skippedUnchanged = 0
  let failed = 0

  for (const product of products) {
    try {
      const currentStatus = String(product.registrationStatus ?? '').trim()
      if (currentStatus && !GATEABLE_STATUSES.has(currentStatus)) {
        skippedUnchanged += 1
        continue
      }
      const rows = parseScheduleRows(product.schedule)
      const lane = resolveRegisterAdminLane({
        listingKind: product.listingKind,
        productType: product.productType,
        sportsThemeTag: product.sportsThemeTag,
      })
      const photosReady = isRegisterPendingPhotosReady(product.bgImageUrl, product.schedule)
      const supplierKey =
        normalizeSupplierOrigin(String(product.originSource ?? product.brand?.brandKey ?? '').trim()) ??
        String(product.originSource ?? '').trim()
      const mapped = rows.map((row) => ({
        day: Number(row.day) || 0,
        title: row.title != null ? String(row.title) : null,
        description: row.description != null ? String(row.description) : null,
        routeText: row.routeText != null ? String(row.routeText) : null,
        imageKeyword: row.imageKeyword != null ? String(row.imageKeyword) : null,
        imageKeyword2: row.imageKeyword2 != null ? String(row.imageKeyword2) : null,
        imageUrl: row.imageUrl != null ? String(row.imageUrl) : null,
      }))

      const destLine = String(product.destination ?? '').split(/\n/)[0]?.trim() ?? ''
      // dest 항공권·석식·하이라이트 나열도 제목 지명으로만 채운다 (그랜드월드 ≠ 푸꾸옥)
      // REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: 힐 전에 dest 추론 — manifest
      const destNeedsInfer =
        /^(?:미입력|미지정|미정|상품명 없음)$/i.test(destLine) ||
        !isRegisterPrePhotoPlaceLikeDestination(destLine) ||
        /왕복\s*항공|항공권|비즈니스|대기예약|판매마감|왜 이제 왔을까|SNS맛집|완전일주|HIGH&|그랜드월드|호국사\s*외|한시장|로망!|여행일정/i.test(
          destLine,
        )
      const inferredDest = destNeedsInfer
        ? inferRegisterPendingDestinationFromTitle(String(product.title ?? ''))
        : ''
      const productDestination = inferredDest || product.destination

      let next = rows
      let imageUrlCleared = 0
      let healNotes: RegisterPrePhotoHealNote[] = []
      let verifyRows = mapped
      let scheduleChanged = false

      if (rows.length) {
        byLane[lane] += 1
        const result = healRegisterPrePhotoSchedule(mapped, {
          supplierKey,
          productDestination,
          productTitle: product.title,
          lane,
        })
        healNotes = result.notes
        verifyRows = result.rows.map((h) => ({
          day: Number(h.day),
          title: h.title,
          description: h.description,
          routeText: h.routeText,
          imageKeyword: h.imageKeyword,
          imageKeyword2: h.imageKeyword2,
          imageUrl: h.imageUrl,
        }))
        const byDay = new Map(result.rows.map((r) => [Number(r.day), r]))
        next = rows.map((row) => {
          const h = byDay.get(Number(row.day))
          if (!h) return row
          let imageUrl = row.imageUrl
          const rawUrl = imageUrl != null ? String(imageUrl) : ''
          if (!photosReady && isObviouslyBrokenScheduleImageUrl(rawUrl)) {
            imageUrl = null
            imageUrlCleared += 1
          }
          return {
            ...row,
            imageKeyword: h.imageKeyword ?? '',
            imageKeyword2: h.imageKeyword2 ?? null,
            description: h.description ?? row.description,
            imageUrl,
          }
        })
        if (photosReady) {
          skippedPhotosReady += 1
        } else if (probeImageUrls) {
          let probed = 0
          for (const row of next) {
            if (probed >= 8) break
            const url = row.imageUrl != null ? String(row.imageUrl).trim() : ''
            if (!url) continue
            probed += 1
            const status = await probeRegisterScheduleImageUrl(url)
            if (status === 'broken') {
              row.imageUrl = null
              imageUrlCleared += 1
            }
          }
        }
        scheduleChanged = registerPendingScheduleJsonChanged(next, product.schedule) || imageUrlCleared > 0
      }

      const verify = verifyRegisterPrePhoto({
        lane,
        listingKind: product.listingKind,
        productType: product.productType,
        sportsThemeTag: product.sportsThemeTag,
        productDestination,
        productTitle: product.title,
        rows: verifyRows,
      })
      if (verify.ok) verified += 1
      else verifyFailed += 1
      const nextStatus = registrationStatusAfterPrePhotoVerify(verify)
      const statusChanged = currentStatus !== nextStatus
      if (statusChanged && nextStatus === REGISTER_PRE_PHOTO_BLOCKED_STATUS) blocked += 1
      if (statusChanged && nextStatus === 'pending' && currentStatus === REGISTER_PRE_PHOTO_BLOCKED_STATUS) {
        promoted += 1
      }
      const nextJson = JSON.stringify(next)
      const nextRawMeta = mergeRegisterPrePhotoStampIntoRawMeta(product.rawMeta, verify)
      const stampChanged = nextRawMeta !== String(product.rawMeta ?? '')
      if (!scheduleChanged && !stampChanged && !statusChanged && healNotes.length === 0) {
        skippedUnchanged += 1
        continue
      }
      if (!dryRun) {
        // REGRESSION-FREEZE[register-pre-photo-heal-prisma-retry]: 수집과 겹쳐도 저장 재시도 — manifest
        await withPrismaRetry(`heal-pending:${product.id}`, () =>
          prisma.product.update({
            where: { id: product.id },
            data: {
              ...(scheduleChanged ? { schedule: nextJson } : {}),
              ...(statusChanged ? { registrationStatus: nextStatus } : {}),
              ...(inferredDest ? { destination: inferredDest } : {}),
              rawMeta: nextRawMeta,
            },
          }),
        )
        if (scheduleChanged && lane !== 'air_hotel_free') {
          try {
            for (const h of verifyRows) {
              if (!h.description) continue
              await withPrismaRetry(`heal-itinerary:${product.id}:${h.day}`, () =>
                prisma.itineraryDay.updateMany({
                  where: { productId: product.id, day: Number(h.day) },
                  data: { summaryTextRaw: String(h.description) },
                }),
              )
            }
          } catch (itineraryErr) {
            console.error('[register-pre-photo-self-heal] itinerary sync skipped', product.id, itineraryErr)
          }
        }
      }
      if (scheduleChanged || healNotes.length > 0) healed += 1
      else if (!stampChanged && !statusChanged) skippedUnchanged += 1
      for (const n of healNotes.slice(0, 4)) {
        if (notesSample.length < 24) notesSample.push(n)
      }
    } catch (e) {
      failed += 1
      console.error('[register-pre-photo-self-heal] product failed', product.id, e)
      if (!dryRun) {
        await holdOffPendingQueueIfNotPublic(product.id)
      }
    }
  }

  return {
    scanned: products.length,
    healed,
    verified,
    verifyFailed,
    blocked,
    promoted,
    skippedPhotosReady,
    skippedUnchanged,
    failed,
    ingestPerGeo: 1,
    ingestSkipped: 'listing_collect_not_in_this_job',
    notesSample,
    byLane,
  }
}

function registerPendingScheduleJsonChanged(
  next: Array<Record<string, unknown>>,
  raw: string | null | undefined,
): boolean {
  const nextNorm = JSON.stringify(next)
  try {
    const prev = JSON.parse(String(raw ?? ''))
    if (!Array.isArray(prev)) return nextNorm !== String(raw ?? '')
    return nextNorm !== JSON.stringify(prev)
  } catch {
    return nextNorm !== String(raw ?? '')
  }
}

async function holdOffPendingQueueIfNotPublic(productId: string): Promise<void> {
  try {
    await withPrismaRetry(`heal-hold-off:${productId}`, () =>
      prisma.product.updateMany({
        where: {
          id: productId,
          OR: [{ registrationStatus: null }, { registrationStatus: '' }, { registrationStatus: 'pending' }],
        },
        data: { registrationStatus: REGISTER_PRE_PHOTO_BLOCKED_STATUS },
      }),
    )
  } catch (err) {
    console.error('[register-pre-photo-self-heal] hold-off pending failed', productId, err)
  }
}

/** 수동·수집 confirm 저장 직후 — 힐+검증 통과만 pending. 실패·예외는 등록대기에 안 남긴다. */
export async function applyRegisterPrePhotoQueueGateAfterSave(
  productId: string,
): Promise<HealPendingPrePhotoResult | null> {
  const id = String(productId ?? '').trim()
  if (!id) return null
  try {
    const result = await healPendingRegisterPrePhoto({ productId: id, limit: 1, probeImageUrls: false })
    if (result.failed > 0 || result.scanned < 1) {
      await holdOffPendingQueueIfNotPublic(id)
    }
    return result
  } catch (err) {
    console.error('[register-pre-photo-self-heal] gate threw', id, err)
    await holdOffPendingQueueIfNotPublic(id)
    return null
  }
}
