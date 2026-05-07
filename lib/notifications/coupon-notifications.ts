/**
 * 쿠폰 관련 카카오 알림톡 — 트리거(PHASE G/H 등)에서 호출하기 위한 얇은 헬퍼.
 *
 * 트리거 ↔ 헬퍼 연결 표 (기존 프롬프트의 LMS 발송 문구 대체):
 * - G-1 가입 보너스 → `notifyCouponWelcome`
 * - G-2 추천 가입자 → `notifyCouponReferralInvitee`
 * - G-3 리뷰 보상 → `notifyCouponReviewReward`
 * - D-5 추천인 지연 발급 → `notifyCouponReferralInviter`
 * - H-1 생일 cron → `notifyCouponBirthday`
 * - H-2 만료 임박 cron → `notifyCouponExpiry`
 *
 * 저장소 내 해당 트리거 구현이 생기면 위 함수를 해당 지점에서 `await` 호출하면 된다.
 */
import { sendKakaoNotification, type KakaoDispatchResult } from '@/lib/notifications/kakao-dispatch'

export type CouponNotifyUser = {
  id?: string | null
  email?: string | null
  name?: string | null
  phone?: string | null
}

export type CouponNotifyGrant = {
  amountKrw: number | string
  expiresAt: Date | string | number
  /** `coupon_expiry_reminder` 템플릿용 */
  couponLabel?: string | null
}

function displayName(user: CouponNotifyUser): string {
  const n = user.name?.trim()
  return n && n.length > 0 ? n : '고객'
}

function formatAmountKrw(v: number | string): string {
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v))
  const s = String(v).trim()
  return s.length > 0 ? s : '0'
}

function formatExpiresAt(v: Date | string | number): string {
  const d =
    v instanceof Date
      ? v
      : typeof v === 'number'
        ? new Date(v)
        : new Date(String(v))
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(d)
}

function recipientPhone(user: CouponNotifyUser): string | null {
  const raw = user.phone?.trim()
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 10 ? raw : null
}

async function guardNotify(fn: () => Promise<KakaoDispatchResult>): Promise<KakaoDispatchResult> {
  try {
    return await fn()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[coupon-notify] unexpected', msg)
    return { ok: false, dryRun: false, error: msg }
  }
}

export async function notifyCouponWelcome(
  user: CouponNotifyUser,
  userCoupon: CouponNotifyGrant,
): Promise<KakaoDispatchResult> {
  const phone = recipientPhone(user)
  if (!phone) {
    return { ok: true, dryRun: true, error: 'no-phone' }
  }
  const name = displayName(user)
  return guardNotify(() =>
    sendKakaoNotification({
      to: phone,
      templateKey: 'coupon_welcome',
      variables: {
        name,
        amount: formatAmountKrw(userCoupon.amountKrw),
        expiresAt: formatExpiresAt(userCoupon.expiresAt),
      },
      userId: user.id ?? undefined,
      userEmail: user.email ?? undefined,
    }),
  )
}

export async function notifyCouponBirthday(
  user: CouponNotifyUser,
  userCoupon: CouponNotifyGrant,
): Promise<KakaoDispatchResult> {
  const phone = recipientPhone(user)
  if (!phone) {
    return { ok: true, dryRun: true, error: 'no-phone' }
  }
  const name = displayName(user)
  return guardNotify(() =>
    sendKakaoNotification({
      to: phone,
      templateKey: 'coupon_birthday',
      variables: {
        name,
        amount: formatAmountKrw(userCoupon.amountKrw),
        expiresAt: formatExpiresAt(userCoupon.expiresAt),
      },
      userId: user.id ?? undefined,
      userEmail: user.email ?? undefined,
    }),
  )
}

export async function notifyCouponReviewReward(
  user: CouponNotifyUser,
  userCoupon: CouponNotifyGrant,
): Promise<KakaoDispatchResult> {
  const phone = recipientPhone(user)
  if (!phone) {
    return { ok: true, dryRun: true, error: 'no-phone' }
  }
  const name = displayName(user)
  return guardNotify(() =>
    sendKakaoNotification({
      to: phone,
      templateKey: 'coupon_review_reward',
      variables: {
        name,
        amount: formatAmountKrw(userCoupon.amountKrw),
        expiresAt: formatExpiresAt(userCoupon.expiresAt),
      },
      userId: user.id ?? undefined,
      userEmail: user.email ?? undefined,
    }),
  )
}

export async function notifyCouponReferralInvitee(
  user: CouponNotifyUser,
  userCoupon: CouponNotifyGrant,
  inviter: { name: string },
): Promise<KakaoDispatchResult> {
  const phone = recipientPhone(user)
  if (!phone) {
    return { ok: true, dryRun: true, error: 'no-phone' }
  }
  const name = displayName(user)
  const inviterName = inviter.name?.trim() || '추천인'
  return guardNotify(() =>
    sendKakaoNotification({
      to: phone,
      templateKey: 'coupon_referral_invitee',
      variables: {
        name,
        amount: formatAmountKrw(userCoupon.amountKrw),
        expiresAt: formatExpiresAt(userCoupon.expiresAt),
        inviterName,
      },
      userId: user.id ?? undefined,
      userEmail: user.email ?? undefined,
    }),
  )
}

export async function notifyCouponReferralInviter(
  inviter: CouponNotifyUser,
  userCoupon: CouponNotifyGrant,
  invitee: { name: string },
): Promise<KakaoDispatchResult> {
  const phone = recipientPhone(inviter)
  if (!phone) {
    return { ok: true, dryRun: true, error: 'no-phone' }
  }
  const name = displayName(inviter)
  const inviteeName = invitee.name?.trim() || '친구'
  return guardNotify(() =>
    sendKakaoNotification({
      to: phone,
      templateKey: 'coupon_referral_inviter',
      variables: {
        name,
        amount: formatAmountKrw(userCoupon.amountKrw),
        expiresAt: formatExpiresAt(userCoupon.expiresAt),
        inviteeName,
      },
      userId: inviter.id ?? undefined,
      userEmail: inviter.email ?? undefined,
    }),
  )
}

export async function notifyCouponExpiry(
  user: CouponNotifyUser,
  userCoupon: CouponNotifyGrant,
): Promise<KakaoDispatchResult> {
  const phone = recipientPhone(user)
  if (!phone) {
    return { ok: true, dryRun: true, error: 'no-phone' }
  }
  const name = displayName(user)
  const couponLabel = userCoupon.couponLabel?.trim() || '보유 쿠폰'
  return guardNotify(() =>
    sendKakaoNotification({
      to: phone,
      templateKey: 'coupon_expiry_reminder',
      variables: {
        name,
        couponLabel,
        amount: formatAmountKrw(userCoupon.amountKrw),
        expiresAt: formatExpiresAt(userCoupon.expiresAt),
      },
      userId: user.id ?? undefined,
      userEmail: user.email ?? undefined,
    }),
  )
}
