/**
 * 등록대기 상세를 열 때 — 라이브 검증 실패면 셀프힐·레인 remat으로 검증 통과까지 끌어올린다.
 * 목적: 강등이 아니라 통과. 막판에 pre_photo_blocked로 내리지 않는다.
 * REGRESSION-FREEZE[pending-open-self-heal-verify]: 상세 오픈 시 힐·재검증 — manifest
 */

import { prisma } from '@/lib/prisma'
import { healPendingRegisterPrePhoto } from '@/lib/register-pending-pre-photo-self-heal'
import { REGISTER_PRE_PHOTO_BLOCKED_STATUS } from '@/lib/register-pre-photo-pending-queue'
import { refreshRegisterPrePhotoQueueFlagsForProductId } from '@/lib/register-pre-photo-queue-flags'
import {
  rematerializeRegisterPrePhotoByLane,
  registerPrePhotoIssuesNeedLaneRematerialize,
} from '@/lib/register-pre-photo-lane-rematerialize'
import {
  verifyRegisterPrePhotoForStoredProduct,
  type RegisterPrePhotoVerifyIssue,
} from '@/lib/register-pre-photo-verify'
import { isRegisterPendingPhotosReady } from '@/lib/register-pending-photos-ready'

export type PendingOpenHealResult = {
  productId: string
  ranHeal: boolean
  ranRematerialize: boolean
  verified: boolean
  /** pending + verify.ok — 사진·승인 가능 */
  queueReady: boolean
  registrationStatus: string | null
  issues: RegisterPrePhotoVerifyIssue[]
  photosReady: boolean
}

const SELECT_FOR_VERIFY = {
  listingKind: true,
  productType: true,
  sportsThemeTag: true,
  schedule: true,
  destination: true,
  title: true,
  countryKey: true,
  registrationStatus: true,
  bgImageUrl: true,
  registerPrePhotoQueueReady: true,
} as const

/** 운영자 오픈 경로 — 힐이 막았어도 pending으로 되돌려 교정 기회를 남긴다 */
async function ensurePendingNotBlocked(productId: string): Promise<void> {
  await prisma.product.updateMany({
    where: {
      id: productId,
      registrationStatus: REGISTER_PRE_PHOTO_BLOCKED_STATUS,
    },
    data: {
      registrationStatus: 'pending',
      rejectReason: null,
      rejectedAt: null,
    },
  })
}

/**
 * 운영자 상세 오픈: 검증 통과까지 heal → (필요 시) lane remat → heal 재시도.
 * 실패해도 강등하지 않고 pending을 유지한 채 이슈만 반환한다.
 */
export async function healAndGatePendingProductForOperator(
  productId: string,
): Promise<PendingOpenHealResult> {
  const id = String(productId || '').trim()
  if (!id) {
    return {
      productId: '',
      ranHeal: false,
      ranRematerialize: false,
      verified: false,
      queueReady: false,
      registrationStatus: null,
      issues: ['title_placeholder'],
      photosReady: false,
    }
  }

  const before = await prisma.product.findUnique({ where: { id }, select: SELECT_FOR_VERIFY })
  if (!before) {
    return {
      productId: id,
      ranHeal: false,
      ranRematerialize: false,
      verified: false,
      queueReady: false,
      registrationStatus: null,
      issues: ['title_placeholder'],
      photosReady: false,
    }
  }

  const status0 = String(before.registrationStatus ?? '').trim()
  const gateable =
    !status0 || status0 === 'pending' || status0 === REGISTER_PRE_PHOTO_BLOCKED_STATUS
  if (!gateable) {
    const v = verifyRegisterPrePhotoForStoredProduct(before)
    return {
      productId: id,
      ranHeal: false,
      ranRematerialize: false,
      verified: v.ok,
      queueReady: false,
      registrationStatus: before.registrationStatus,
      issues: v.issues,
      photosReady: isRegisterPendingPhotosReady(before.bgImageUrl, before.schedule),
    }
  }

  // 이미 blocked면 pending으로 올려 교정 대상에 넣는다
  if (status0 === REGISTER_PRE_PHOTO_BLOCKED_STATUS) {
    await ensurePendingNotBlocked(id)
  }

  let verify = verifyRegisterPrePhotoForStoredProduct(before)
  let ranHeal = false
  let ranRematerialize = false

  // REGRESSION-FREEZE[pending-open-self-heal-verify]: 실패 시 heal → remat → heal — manifest
  if (!verify.ok) {
    ranHeal = true
    await healPendingRegisterPrePhoto({ productId: id, limit: 1 })
    await ensurePendingNotBlocked(id)

    let mid = await prisma.product.findUnique({ where: { id }, select: SELECT_FOR_VERIFY })
    verify = mid ? verifyRegisterPrePhotoForStoredProduct(mid) : verify

    if (!verify.ok && registerPrePhotoIssuesNeedLaneRematerialize(verify.issues)) {
      ranRematerialize = true
      await rematerializeRegisterPrePhotoByLane(id)
      await healPendingRegisterPrePhoto({ productId: id, limit: 1 })
      await ensurePendingNotBlocked(id)
    } else if (!verify.ok) {
      // remat 대상이 아니어도 한 번 더 키워드 재할당·힐 (운영자 오픈 경로)
      ranRematerialize = true
      await rematerializeRegisterPrePhotoByLane(id)
      await healPendingRegisterPrePhoto({ productId: id, limit: 1 })
      await ensurePendingNotBlocked(id)
    }
  }

  const after = await prisma.product.findUnique({ where: { id }, select: SELECT_FOR_VERIFY })
  if (!after) {
    return {
      productId: id,
      ranHeal,
      ranRematerialize,
      verified: false,
      queueReady: false,
      registrationStatus: null,
      issues: verify.issues,
      photosReady: false,
    }
  }

  verify = verifyRegisterPrePhotoForStoredProduct(after)

  // 통과 시에만 큐 플래그·pending 확정. 실패해도 강등하지 않는다.
  if (verify.ok) {
    await ensurePendingNotBlocked(id)
    await prisma.product.update({
      where: { id },
      data: {
        registrationStatus: 'pending',
        registerPrePhotoQueueReady: true,
        registerPhotosReady: isRegisterPendingPhotosReady(after.bgImageUrl, after.schedule),
        rejectReason: null,
        rejectedAt: null,
      },
    })
  } else {
    await ensurePendingNotBlocked(id)
    // 플래그는 라이브 검증과 맞추되, 상태는 pending 유지 (야간 힐이 다시 시도)
    await refreshRegisterPrePhotoQueueFlagsForProductId(id)
    await ensurePendingNotBlocked(id)
  }

  const final = await prisma.product.findUnique({ where: { id }, select: SELECT_FOR_VERIFY })
  const row = final ?? after
  const verified = verify.ok
  const finalStatus = String(row.registrationStatus ?? '').trim()

  return {
    productId: id,
    ranHeal,
    ranRematerialize,
    verified,
    queueReady: verified && finalStatus === 'pending',
    registrationStatus: row.registrationStatus,
    issues: verify.issues,
    photosReady: isRegisterPendingPhotosReady(row.bgImageUrl, row.schedule),
  }
}
