/**
 * 카카오 비즈센터에서 등록·승인 후 환경변수로 templateId 주입.
 * 미등록 상태에서는 placeholder 사용 — DRY_RUN 모드에서 로그만 남기므로 무해.
 */
export type KakaoTemplateKey =
  | 'coupon_welcome'
  | 'coupon_birthday'
  | 'coupon_review_reward'
  | 'coupon_referral_invitee'
  | 'coupon_referral_inviter'
  | 'coupon_expiry_reminder'

export type KakaoTemplateSpec = {
  templateId: string
  description: string
  readonly requiredVars: readonly string[]
  sampleText: string
}

export const KAKAO_TEMPLATES: Record<KakaoTemplateKey, KakaoTemplateSpec> = {
  coupon_welcome: {
    templateId: process.env.SOLAPI_KAKAO_TPL_COUPON_WELCOME ?? '__TBD__COUPON_WELCOME__',
    description: '가입 환영 + 가입 보너스 쿠폰 발급 안내',
    requiredVars: ['name', 'amount', 'expiresAt'],
    sampleText:
      '#{name}님, 봉투어 가입을 환영해요!\n환영 쿠폰 #{amount}원이 도착했어요.\n사용 기한: #{expiresAt}\n쿠폰함에서 확인하기 →',
  },
  coupon_birthday: {
    templateId: process.env.SOLAPI_KAKAO_TPL_COUPON_BIRTHDAY ?? '__TBD__COUPON_BIRTHDAY__',
    description: '생일 축하 + 생일 쿠폰 발급',
    requiredVars: ['name', 'amount', 'expiresAt'],
    sampleText:
      '#{name}님, 생일을 진심으로 축하드려요 🎂\n생일 쿠폰 #{amount}원이 쿠폰함에 도착했어요.\n사용 기한: #{expiresAt}',
  },
  coupon_review_reward: {
    templateId: process.env.SOLAPI_KAKAO_TPL_COUPON_REVIEW ?? '__TBD__COUPON_REVIEW__',
    description: '리뷰 작성 감사 + 보상 쿠폰',
    requiredVars: ['name', 'amount', 'expiresAt'],
    sampleText:
      '#{name}님, 소중한 리뷰 감사합니다.\n보상 쿠폰 #{amount}원을 발급해드렸어요.\n사용 기한: #{expiresAt}',
  },
  coupon_referral_invitee: {
    templateId:
      process.env.SOLAPI_KAKAO_TPL_COUPON_REFERRAL_INVITEE ?? '__TBD__COUPON_REFERRAL_INVITEE__',
    description: '추천 코드로 가입한 사람에게 보너스 안내',
    requiredVars: ['name', 'amount', 'expiresAt', 'inviterName'],
    sampleText:
      '#{name}님, #{inviterName}님의 초대로 가입하셨네요!\n초대 보너스 #{amount}원이 쿠폰함에 도착했어요.\n사용 기한: #{expiresAt}',
  },
  coupon_referral_inviter: {
    templateId:
      process.env.SOLAPI_KAKAO_TPL_COUPON_REFERRAL_INVITER ?? '__TBD__COUPON_REFERRAL_INVITER__',
    description: '초대한 친구가 첫 결제 — 추천인에게 보상',
    requiredVars: ['name', 'amount', 'expiresAt', 'inviteeName'],
    sampleText:
      '#{name}님, 좋은 소식이에요!\n#{inviteeName}님이 첫 결제를 완료해서 추천인 보상 #{amount}원이 발급됐어요.\n사용 기한: #{expiresAt}',
  },
  coupon_expiry_reminder: {
    templateId: process.env.SOLAPI_KAKAO_TPL_COUPON_EXPIRY ?? '__TBD__COUPON_EXPIRY__',
    description: '쿠폰 만료 D-3 알림',
    requiredVars: ['name', 'couponLabel', 'amount', 'expiresAt'],
    sampleText:
      '#{name}님, 보유하신 쿠폰이 곧 만료돼요.\n· #{couponLabel} #{amount}원\n· 만료일: #{expiresAt}\n쿠폰함에서 사용하기 →',
  },
}
