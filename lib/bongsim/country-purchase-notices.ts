/**
 * 국가·권역별 구매 전 안내.
 * 공통 안내는 로밍형(요금폭탄·QR 1회성·기기) 톤.
 * 개통·설치 정책은 운영자 확정분만 국가별로 넣는다.
 * - 홍콩·마카오·대만: 입국 전 한국에서 설치 (확정)
 * - 중국 본토 선활성 제한 등 미확정 추정 문구는 넣지 않음
 */
// REGRESSION-FREEZE[bongsim-cn-purchase-notices-user-facing]: HK/MO/TW 한국 선설치·미확정 본토개통 비노출 — manifest

export type CountryNoticeSeverity = "info" | "warning";

export type CountryPurchaseNotice = {
  severity: CountryNoticeSeverity;
  title: string;
  body: string;
};

/**
 * 모든 국가·권역 구매 화면에 공통으로 노출.
 * (플랜 팝업에는 넣지 않음 — CountryPurchaseNoticeList SSOT)
 */
export const GENERAL_PURCHASE_NOTICES: CountryPurchaseNotice[] = [
  {
    severity: "warning",
    title: "요금 폭탄 방지",
    body: "해외에서는 국내 유심의 데이터 로밍을 끄고, 모바일 데이터는 Bong투어 eSIM만 사용하세요. 유심 로밍이 켜져 있으면 국내 통신사 요금이 나갈 수 있습니다.",
  },
  {
    severity: "warning",
    title: "QR·설치코드는 1회성",
    body: "같은 QR을 여러 기기에 반복 설치할 수 없고, 설치 후 eSIM을 지우면 재설치가 어려운 경우가 많습니다. 여행이 끝난 뒤에만 삭제하세요.",
  },
  {
    severity: "info",
    title: "eSIM 지원 기기만 가능",
    body: "구매 전 「이용 가능 기기」에서 내 휴대폰이 eSIM을 지원하는지 확인해 주세요. 미지원 기기는 설치할 수 없습니다.",
  },
  {
    severity: "info",
    title: "설치 시점은 상품마다 달라요",
    body: "출국 전 설치 가능한 상품과 현지 도착 후 설치를 권장하는 상품이 있습니다. 상세 안내·마이페이지·카카오 알림톡을 꼭 확인하세요.",
  },
];

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

/** code → 국가·권역 전용 안내. KYC는 상품 flags.kyc 기준 — 여기에 넣지 않음. */
export const COUNTRY_PURCHASE_NOTICES: Record<string, CountryPurchaseNotice[]> = {
  cn: CN_NOTICES,
  hk: HK_MO_TW_INSTALL_NOTICES,
  mo: HK_MO_TW_INSTALL_NOTICES,
  tw: HK_MO_TW_INSTALL_NOTICES,
  "rg-hk-mo": RG_HK_MO_NOTICES,
  "rg-cn-hk-mo": RG_CN_HK_MO_NOTICES,
};

function dedupeNotices(list: CountryPurchaseNotice[]): CountryPurchaseNotice[] {
  const seen = new Set<string>();
  const out: CountryPurchaseNotice[] = [];
  for (const n of list) {
    const key = `${n.severity}:${n.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

export function getCountryPurchaseNotices(code: string): CountryPurchaseNotice[] {
  const specific = COUNTRY_PURCHASE_NOTICES[code.toLowerCase()] ?? [];
  return dedupeNotices([...GENERAL_PURCHASE_NOTICES, ...specific]);
}

export function getMergedPurchaseNotices(codes: string[]): CountryPurchaseNotice[] {
  const out: CountryPurchaseNotice[] = [...GENERAL_PURCHASE_NOTICES];
  for (const code of codes) {
    const specific = COUNTRY_PURCHASE_NOTICES[code.toLowerCase()] ?? [];
    out.push(...specific);
  }
  return dedupeNotices(out);
}
