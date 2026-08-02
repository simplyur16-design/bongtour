/** 국가·권역별 구매 전 안내 — usimsa purchase-notice 패턴 (eSIM 보상 항목 제외). */
// REGRESSION-FREEZE[bongsim-cn-purchase-notices-user-facing]: 중국 안내 1회·공급사 코드 비노출 — manifest

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
  {
    severity: "warning",
    title: "중국 본토에서는 처음 개통이 안 될 수 있어요",
    body: "중국 본토 데이터가 포함된 일부 상품은 본토 안에서 처음 활성화가 되지 않습니다. 입국 전 홍콩·마카오·대만 등 본토 밖에서 eSIM을 설치·활성화한 뒤, 3~5분 이상 네트워크에 연결해 주세요. (여행자 인증은 필요 없습니다.)",
  },
];

const RG_CN_HK_MO_NOTICES: CountryPurchaseNotice[] = [
  ...CN_NOTICES,
  {
    severity: "info",
    title: "중국·홍콩·마카오 권역",
    body: "선택한 플랜이 커버하는 국가·지역을 상품 상세에서 확인해 주세요. 권역 패키지는 국가별 정책이 다를 수 있습니다.",
  },
];

const HK_MO_NOTICES: CountryPurchaseNotice[] = [
  {
    severity: "info",
    title: "홍콩·마카오 경유",
    body: "중국 본토 입국 전 홍콩·마카오에서 eSIM 활성화가 필요한 상품이 있습니다. 상품별 활성화 정책을 확인해 주세요.",
  },
];

/** code → 구매 전 안내. KYC(여행자 인증)는 상품 `flags.kyc` 기준 — 국가 공통 안내에 넣지 않음. */
export const COUNTRY_PURCHASE_NOTICES: Record<string, CountryPurchaseNotice[]> = {
  cn: CN_NOTICES,
  "rg-cn-hk-mo": RG_CN_HK_MO_NOTICES,
  hk: HK_MO_NOTICES,
  mo: HK_MO_NOTICES,
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
