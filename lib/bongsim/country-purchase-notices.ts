/**
 * 국가·권역별 구매 전 안내.
 * 개통·설치 정책은 운영자 확정분만 넣는다.
 * - 홍콩·마카오·대만: 입국 전 한국에서 설치 (확정)
 * - 중국 본토 최초 개통 불가 등 미확정 추정 문구는 넣지 않음
 */
// REGRESSION-FREEZE[bongsim-cn-purchase-notices-user-facing]: HK/MO/TW 한국 선설치·미확정 본토개통 비노출 — manifest

export type CountryNoticeSeverity = "info" | "warning";

export type CountryPurchaseNotice = {
  severity: CountryNoticeSeverity;
  title: string;
  body: string;
};

const CN_NOTICES: CountryPurchaseNotice[] = [
  {
    severity: "info",
    title: "VPN 없이 SNS·유튜브 이용",
    body: "중국 로밍 eSIM은 별도 VPN 없이 카카오톡, 유튜브, 인스타그램 등을 이용할 수 있는 상품이 있습니다. 선택한 플랜의 망·용량 조건을 확인해 주세요.",
  },
  {
    severity: "info",
    title: "일일 데이터·저속 무제한",
    body: "데일리 플랜은 하루 제공량을 모두 쓴 뒤 저속 무제한으로 이어질 수 있습니다. 완전 무제한 상품은 별도 정책이 적용됩니다.",
  },
];

/** 운영 확정: 홍콩·마카오·대만은 입국 전 한국에서 설치 */
const HK_MO_TW_INSTALL_NOTICES: CountryPurchaseNotice[] = [
  {
    severity: "warning",
    title: "입국 전 한국에서 설치해 주세요",
    body: "홍콩·마카오·대만 eSIM은 현지 도착 후가 아니라, 출국 전 한국에서 미리 설치해야 합니다. 설치·설정은 마이페이지 안내를 따라 주세요.",
  },
];

const RG_CN_HK_MO_NOTICES: CountryPurchaseNotice[] = [
  ...CN_NOTICES,
  ...HK_MO_TW_INSTALL_NOTICES,
  {
    severity: "info",
    title: "중국·홍콩·마카오 권역",
    body: "선택한 플랜이 커버하는 국가·지역을 상품 상세에서 확인해 주세요. 권역 패키지는 국가별 정책이 다를 수 있습니다.",
  },
];

const RG_HK_MO_NOTICES: CountryPurchaseNotice[] = [...HK_MO_TW_INSTALL_NOTICES];

/** code → 구매 전 안내. KYC(여행자 인증)는 상품 `flags.kyc` 기준 — 국가 공통 안내에 넣지 않음. */
export const COUNTRY_PURCHASE_NOTICES: Record<string, CountryPurchaseNotice[]> = {
  cn: CN_NOTICES,
  hk: HK_MO_TW_INSTALL_NOTICES,
  mo: HK_MO_TW_INSTALL_NOTICES,
  tw: HK_MO_TW_INSTALL_NOTICES,
  "rg-hk-mo": RG_HK_MO_NOTICES,
  "rg-cn-hk-mo": RG_CN_HK_MO_NOTICES,
};

export function getCountryPurchaseNotices(code: string): CountryPurchaseNotice[] {
  return COUNTRY_PURCHASE_NOTICES[code.toLowerCase()] ?? [];
}

export function getMergedPurchaseNotices(codes: string[]): CountryPurchaseNotice[] {
  const seen = new Set<string>();
  const out: CountryPurchaseNotice[] = [];
  for (const code of codes) {
    for (const n of getCountryPurchaseNotices(code)) {
      const key = `${n.severity}:${n.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(n);
    }
  }
  return out;
}
