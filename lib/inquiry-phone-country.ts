/**
 * 문의 `?lang=en` 연락처 — 국가번호 선택 + 뒷번호만.
 * REGRESSION-FREEZE[inquiry-lang-en-field-phone]: 기본 KR +82, 합성 E.164 — manifest
 */
export type InquiryPhoneCountry = {
  iso: string
  dial: string
  en: string
}

export const INQUIRY_DEFAULT_PHONE_ISO = 'KR'

/** 한국을 맨 앞. 나머지는 영문 이름순. */
export const INQUIRY_PHONE_COUNTRIES: InquiryPhoneCountry[] = [
  { iso: 'KR', dial: '82', en: 'Korea' },
  { iso: 'AU', dial: '61', en: 'Australia' },
  { iso: 'AT', dial: '43', en: 'Austria' },
  { iso: 'BE', dial: '32', en: 'Belgium' },
  { iso: 'BR', dial: '55', en: 'Brazil' },
  { iso: 'CA', dial: '1', en: 'Canada' },
  { iso: 'CN', dial: '86', en: 'China' },
  { iso: 'DK', dial: '45', en: 'Denmark' },
  { iso: 'FI', dial: '358', en: 'Finland' },
  { iso: 'FR', dial: '33', en: 'France' },
  { iso: 'DE', dial: '49', en: 'Germany' },
  { iso: 'HK', dial: '852', en: 'Hong Kong' },
  { iso: 'IN', dial: '91', en: 'India' },
  { iso: 'ID', dial: '62', en: 'Indonesia' },
  { iso: 'IE', dial: '353', en: 'Ireland' },
  { iso: 'IL', dial: '972', en: 'Israel' },
  { iso: 'IT', dial: '39', en: 'Italy' },
  { iso: 'JP', dial: '81', en: 'Japan' },
  { iso: 'MO', dial: '853', en: 'Macau' },
  { iso: 'MY', dial: '60', en: 'Malaysia' },
  { iso: 'MX', dial: '52', en: 'Mexico' },
  { iso: 'NL', dial: '31', en: 'Netherlands' },
  { iso: 'NZ', dial: '64', en: 'New Zealand' },
  { iso: 'NO', dial: '47', en: 'Norway' },
  { iso: 'PH', dial: '63', en: 'Philippines' },
  { iso: 'PL', dial: '48', en: 'Poland' },
  { iso: 'RU', dial: '7', en: 'Russia' },
  { iso: 'SA', dial: '966', en: 'Saudi Arabia' },
  { iso: 'SG', dial: '65', en: 'Singapore' },
  { iso: 'ZA', dial: '27', en: 'South Africa' },
  { iso: 'ES', dial: '34', en: 'Spain' },
  { iso: 'SE', dial: '46', en: 'Sweden' },
  { iso: 'CH', dial: '41', en: 'Switzerland' },
  { iso: 'TW', dial: '886', en: 'Taiwan' },
  { iso: 'TH', dial: '66', en: 'Thailand' },
  { iso: 'TR', dial: '90', en: 'Turkey' },
  { iso: 'AE', dial: '971', en: 'UAE' },
  { iso: 'GB', dial: '44', en: 'United Kingdom' },
  { iso: 'US', dial: '1', en: 'United States' },
  { iso: 'VN', dial: '84', en: 'Vietnam' },
]

export function inquiryPhoneCountryByIso(iso: string): InquiryPhoneCountry {
  return INQUIRY_PHONE_COUNTRIES.find((c) => c.iso === iso) ?? INQUIRY_PHONE_COUNTRIES[0]
}

/** 국가번호 + 국내번호 → `+821012345678`. 국내 선행 0은 제거. */
export function composeInquiryIntlPhone(dial: string, national: string): string {
  const cc = dial.replace(/\D/g, '')
  let local = national.replace(/\D/g, '')
  if (!cc || !local) return ''
  if (local.startsWith('0')) local = local.slice(1)
  return `+${cc}${local}`
}
