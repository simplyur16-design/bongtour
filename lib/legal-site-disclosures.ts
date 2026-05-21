import { COMPANY_FOOTER } from '@/lib/company-footer'

/** 약관·개인정보처리방침 페이지 공통 법인·연락 SSOT */
export const LEGAL_ENTITY = {
  legalName: COMPANY_FOOTER.legalName,
  serviceName: 'Bong투어',
  representativeName: '황일연',
  bizRegNo: COMPANY_FOOTER.bizRegNo,
  mailOrderReportNo: COMPANY_FOOTER.mailOrderReportNo,
  tourismRegNo: '제2024-0033호',
  address: COMPANY_FOOTER.addressLine,
  phone: COMPANY_FOOTER.phoneDisplay,
  phoneTel: COMPANY_FOOTER.phoneTel,
  fax: COMPANY_FOOTER.faxDisplay,
  email: COMPANY_FOOTER.emailDisplay,
  emailHref: COMPANY_FOOTER.emailHref,
  privacyOfficerEmail: COMPANY_FOOTER.emailHref,
  jurisdictionCourt: '수원지방법원',
  policyEffectiveDate: '2026년 4월 8일',
  policyRevisedDate: '2026년 5월 21일',
} as const

export const LEGAL_POLICY_LINKS = {
  privacy: '/privacy',
  terms: '/terms',
  esimPolicy: '/travel/esim/policy',
} as const
