/**
 * 등록대기 큐·사진완결 플래그 — admin KPI/list가 schedule JSON 전수 스캔하지 않도록.
 * REGRESSION-FREEZE[admin-pending-queue-flags]: compute + persist — manifest
 */
import type { Prisma } from '@prisma/client'
import { isRegisterPendingPhotosReady } from '@/lib/register-pending-photos-ready'
import { productRowIsLiveRegisterPendingQueue } from '@/lib/register-pre-photo-pending-queue-query'
import { REGISTER_PRE_PHOTO_BLOCKED_STATUS } from '@/lib/register-pre-photo-pending-queue'

export type RegisterPrePhotoQueueFlagSource = {
  listingKind?: string | null
  productType?: string | null
  sportsThemeTag?: string[] | null
  schedule?: string | null
  destination?: string | null
  title?: string | null
  countryKey?: string | null
  bgImageUrl?: string | null
  registrationStatus?: string | null
}

export function computeRegisterPrePhotoQueueFlags(row: RegisterPrePhotoQueueFlagSource): {
  registerPrePhotoQueueReady: boolean
  registerPhotosReady: boolean
} {
  const status = String(row.registrationStatus ?? '').trim()
  const inPendingDb =
    !status || status === 'pending' || status === REGISTER_PRE_PHOTO_BLOCKED_STATUS
  const queueReady =
    inPendingDb &&
    productRowIsLiveRegisterPendingQueue({
      listingKind: row.listingKind ?? null,
      productType: row.productType ?? null,
      sportsThemeTag: row.sportsThemeTag ?? null,
      schedule: row.schedule ?? null,
      destination: row.destination ?? null,
      title: row.title ?? null,
      countryKey: row.countryKey ?? null,
    })
  return {
    registerPrePhotoQueueReady: queueReady,
    registerPhotosReady: isRegisterPendingPhotosReady(row.bgImageUrl, row.schedule),
  }
}

/** Prisma update/create data fragment */
export function registerPrePhotoQueueFlagsUpdateData(
  row: RegisterPrePhotoQueueFlagSource,
): Pick<Prisma.ProductUpdateInput, 'registerPrePhotoQueueReady' | 'registerPhotosReady'> {
  const flags = computeRegisterPrePhotoQueueFlags(row)
  return {
    registerPrePhotoQueueReady: flags.registerPrePhotoQueueReady,
    registerPhotosReady: flags.registerPhotosReady,
  }
}

/** 저장 직후 플래그만 재계산 (이미지 픽·PATCH 등) */
export async function refreshRegisterPrePhotoQueueFlagsForProductId(
  productId: string,
): Promise<void> {
  const id = String(productId ?? '').trim()
  if (!id) return
  const { prisma } = await import('@/lib/prisma')
  const row = await prisma.product.findUnique({
    where: { id },
    select: {
      listingKind: true,
      productType: true,
      sportsThemeTag: true,
      schedule: true,
      destination: true,
      title: true,
      countryKey: true,
      bgImageUrl: true,
      registrationStatus: true,
    },
  })
  if (!row) return
  const data = registerPrePhotoQueueFlagsUpdateData(row)
  await prisma.product.update({ where: { id }, data })
}
