/**
 * QR delivery by SMS — Korean mobile numbers only (+82 10… / 010…).
 * Mirrors server lib/simplyur/checkout/buyer-phone.ts `isSimplyurKoreaMobileForLms`
 * (overseas numbers never take the SMS path). UI hint only; the server rule stays the SSOT.
 */
export function isKoreaMobileForSms(raw: string | null | undefined): boolean {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return false;
  let n = digits;
  if (n.startsWith('82')) n = n.slice(2);
  if (n.startsWith('0')) return /^010\d{7,8}$/.test(n);
  return /^10\d{7,8}$/.test(n);
}

export type QrExtraChannel = 'none' | 'sms' | 'wechat';

/** zh / zh-TW buyers see WeChat first; everyone else starts with "Email only". */
export function qrExtraChannelOrder(locale: string): QrExtraChannel[] {
  return locale === 'zh' || locale === 'zh-TW' ? ['wechat', 'sms', 'none'] : ['none', 'sms', 'wechat'];
}
