/**
 * 등록대기(사진 수급 전) Product.schedule 셀프힐 + 레인별 검증 — Pexels/Gemini 호출 없음.
 * 힐이 등록 SSOT로 고친 뒤 검증 통과만 pending. 실패는 pre_photo_blocked.
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: pending 사진 생성 금지 — manifest
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 등록화면 레인으로 힐·검증 — manifest
 * REGRESSION-FREEZE[pending-approve-photos-ready]: 사진 완료 skip photosReady SSOT — manifest
 * REGRESSION-FREEZE[pre-photo-keyword-verify-before-photos]: 키워드가 나와도 검증 스탬프 — manifest
 * REGRESSION-FREEZE[register-pre-photo-parser-fix]: 검증 실패는 등록대기 금지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-pending-verify-gate]: pre_photo_blocked — manifest
 */
import { prisma } from '@/lib/prisma'
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
  mergeRegisterPrePhotoStampIntoRawMeta,
  verifyRegisterPrePhoto,
} from '@/lib/register-pre-photo-verify'
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
  const limit = Math.min(80, Math.max(1, Math.floor(opts?.limit ?? 80)))
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

      let next = rows
      let imageUrlCleared = 0
      let healNotes: RegisterPrePhotoHealNote[] = []
      let verifyRows = mapped
      let scheduleChanged = false

      if (rows.length) {
        byLane[lane] += 1
        const result = healRegisterPrePhotoSchedule(mapped, {
          supplierKey,
          productDestination: product.destination,
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
        scheduleChanged = JSON.stringify(next) !== String(product.schedule ?? '') || imageUrlCleared > 0
      }

      const verify = verifyRegisterPrePhoto({
        lane,
        listingKind: product.listingKind,
        productType: product.productType,
        sportsThemeTag: product.sportsThemeTag,
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
        await prisma.product.update({
          where: { id: product.id },
          data: {
            ...(scheduleChanged ? { schedule: nextJson } : {}),
            ...(statusChanged ? { registrationStatus: nextStatus } : {}),
            rawMeta: nextRawMeta,
          },
        })
        if (scheduleChanged && lane !== 'air_hotel_free') {
          for (const h of verifyRows) {
            if (!h.description) continue
            await prisma.itineraryDay.updateMany({
              where: { productId: product.id, day: Number(h.day) },
              data: { summaryTextRaw: String(h.description) },
            })
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

/** 수동·수집 confirm 저장 직후 — 검증 통과만 pending. */
export async function applyRegisterPrePhotoQueueGateAfterSave(productId: string): Promise<void> {
  const id = String(productId ?? '').trim()
  if (!id) return
  await healPendingRegisterPrePhoto({ productId: id, limit: 1, probeImageUrls: false })
}
