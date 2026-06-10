import { MARKETING_VERSION_OAUTH } from '@/lib/consent/copies'

/** 회원 User.marketingConsent* 컬럼 SSOT (OAuth 가입·마이페이지 동의 변경) */
export function memberMarketingConsentDbFields(consented: boolean) {
  const now = new Date()
  return {
    marketingConsent: consented,
    marketingConsentAt: consented ? now : null,
    marketingConsentVersion: consented ? MARKETING_VERSION_OAUTH : null,
  }
}
