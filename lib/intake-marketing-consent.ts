import { MARKETING_VERSION_LEAD } from '@/lib/consent/copies'

/** CustomerInquiry·Booking create 시 marketingConsent* 컬럼 SSOT */
export function intakeMarketingConsentDbFields(consented: boolean) {
  const now = new Date()
  return {
    marketingConsent: consented,
    marketingConsentAt: consented ? now : null,
    marketingConsentVersion: consented ? MARKETING_VERSION_LEAD : null,
  }
}
