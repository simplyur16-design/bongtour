import { COMPANY_FOOTER } from "@/lib/company-footer";
import { LEGAL_ENTITY } from "@/lib/legal-site-disclosures";
import type { SimplyurLocale } from "@/lib/simplyur/constants";

// REGRESSION-FREEZE[simplyur-pg-legal-surface]: simplyur PG 심사용 법인·약관 경로 SSOT — manifest

/** PortOne·PG 심사용 사업자 정보 — 주소는 simplyur 표면 영문(addressEn) 우선 */
export const SIMPLYUR_LEGAL_ENTITY = {
  legalName: LEGAL_ENTITY.legalName,
  serviceName: "simplyur",
  serviceDescription: "Korea eSIM for international visitors",
  policyEffectiveDateEn: "April 8, 2026",
  policyRevisedDateEn: "May 21, 2026",
  representativeName: LEGAL_ENTITY.representativeName,
  bizRegNo: LEGAL_ENTITY.bizRegNo,
  mailOrderReportNo: LEGAL_ENTITY.mailOrderReportNo,
  tourismRegNo: LEGAL_ENTITY.tourismRegNo,
  /** 등록 한글 주소 (대조·보관용) */
  address: LEGAL_ENTITY.address,
  /** simplyur 앱·웹 표시용 영문 주소 */
  addressEn: COMPANY_FOOTER.addressLineEn,
  phone: LEGAL_ENTITY.phone,
  phoneTel: LEGAL_ENTITY.phoneTel,
  fax: LEGAL_ENTITY.fax,
  email: LEGAL_ENTITY.email,
  emailHref: LEGAL_ENTITY.emailHref,
  privacyOfficerEmail: LEGAL_ENTITY.privacyOfficerEmail,
  jurisdictionCourt: LEGAL_ENTITY.jurisdictionCourt,
  jurisdictionCourtEn: "Suwon District Court, Republic of Korea",
  policyEffectiveDate: LEGAL_ENTITY.policyEffectiveDate,
  policyRevisedDate: LEGAL_ENTITY.policyRevisedDate,
} as const;

export const SIMPLYUR_FTC_BIZ_VERIFY_HREF =
  "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=2558103455" as const;

export type SimplyurLegalDocument = "terms" | "privacy" | "refund";

export function simplyurLegalPath(locale: SimplyurLocale, doc: SimplyurLegalDocument): string {
  return `/simplyur/${locale}/legal/${doc}`;
}
