/**
 * 카카오 쿠폰 알림톡 디스패처 스모크 — `SOLAPI_KAKAO_DRY_RUN=true` 권장(실발송 없음).
 *
 *   npx tsx scripts/test-kakao-dispatch.ts
 *   npm run test:kakao-dispatch
 */
import './load-env-for-scripts'

import type { KakaoTemplateKey } from '@/lib/notifications/kakao-templates'
import { sendKakaoNotification } from '@/lib/notifications/kakao-dispatch'

process.env.SOLAPI_KAKAO_DRY_RUN = 'true'

const keys: KakaoTemplateKey[] = [
  'coupon_welcome',
  'coupon_birthday',
  'coupon_review_reward',
  'coupon_referral_invitee',
  'coupon_referral_inviter',
  'coupon_expiry_reminder',
]

function varsFor(key: KakaoTemplateKey): Record<string, string> {
  const base = {
    name: '테스트',
    amount: '5000',
    expiresAt: '2030. 1. 1.',
  }
  switch (key) {
    case 'coupon_referral_invitee':
      return { ...base, inviterName: '추천인' }
    case 'coupon_referral_inviter':
      return { ...base, inviteeName: '친구' }
    case 'coupon_expiry_reminder':
      return { ...base, couponLabel: '환영 쿠폰' }
    default:
      return base
  }
}

async function main() {
  const to = '010-1234-5678'
  for (const templateKey of keys) {
    const variables = varsFor(templateKey)
    const r = await sendKakaoNotification({
      to,
      templateKey,
      variables,
      userId: 'test-user',
      userEmail: 'test@example.com',
    })
    console.log('[test-kakao-dispatch]', templateKey, r)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
