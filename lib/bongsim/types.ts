export type CountryOption = {
  code: string;
  nameKr: string;
  flag: string;
  searchTerms?: string[];
  /** Second line under name (e.g. "42개국") */
  subtitleKr?: string;
  isUnlimited?: boolean;
  isRegion?: boolean;
};

/** 이용 가능 기기 모달 — 브랜드 → 시리즈별 예시 목록 */
export type DeviceCompatibilitySeriesGroup = {
  title: string;
  models: string[];
};

export type DeviceCompatibilityBrandSection = {
  brand: string;
  series: DeviceCompatibilitySeriesGroup[];
};

/** 다국가 탭 지역 상품 (아이콘 + 제목 + 부제) */
export type RegionOption = {
  code: string;
  title: string;
  subtitle: string;
  icon: string;
  isUnlimited?: boolean;
  searchTerms?: string[];
};

export type MockCountry = CountryOption;

export type NetworkType = "roaming" | "local";

export type EsimNetworkType = NetworkType;

export type EsimProductTypeOption = {
  networkType: EsimNetworkType;
  label: string;
  helperText?: string;
  startingPrice?: number;
};

/** 비교 행 유형: 국가별 조합(single)·통합 multi·광역/글로벌 global */
export type EsimCoverageType = "single" | "multi" | "global";

/** 일자별 카탈로그 가격(모의). 결과 행은 현재 선택 일수에 맞는 항목이 있을 때만 노출. */
export type EsimCoverageDurationOption = {
  days: number;
  price: number;
};

export type EsimCoverageProduct = {
  id: string;
  coverageType: EsimCoverageType;
  countryCodes: string[];
  title: string;
  subtitle?: string;
  /** 포함 범위 한 줄 요약 */
  coverageSummaryKr?: string;
  /** 왜 이 비교 행이 생겼는지 */
  whyKr?: string;
  startingPrice: number;
  /** 일수별 최저가(네트워크 중 더 낮은 쪽 기준 등) — 현재 trip과 교차 검증용 */
  durationOptions: EsimCoverageDurationOption[];
  availableNetworkTypes: EsimProductTypeOption[];
  isBestPrice?: boolean;
  /** 한 상품으로 선택 국가 전원이 커버될 때만 true (국가별 합산 조합은 false) */
  coversAllSelected?: boolean;
};

export type FunnelState = {
  countryIds: string[];
  /** YYYY-MM-DD 출발(현지 첫날) */
  tripStart: string | null;
  /** YYYY-MM-DD 귀국(현지 마지막 날) */
  tripEnd: string | null;
  /**
   * tripStart·tripEnd만이 날짜의 단일 소스(SSOT).
   * 아래는 저장 시 자동 갱신(표시·다음 단계 전달용, 일수·박 수 불일치 방지).
   */
  tripDurationDays: number | null;
  tripDurationNights: number | null;
  network: NetworkType | null;
  planId: string | null;
  coverageProductId: string | null;
};

export type MockPlan = {
  id: string;
  countryId: string;
  nameKo: string;
  dataSummaryKo: string;
  validityDays: number;
  priceKrw: number;
  networkTypes: NetworkType[];
  highlightsKo: string[];
};

export type MockOrder = {
  orderId: string;
  planId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  createdAtIso: string;
};

export type EsimPlanOption = {
  id: string;
  tierKey: string;
  title: string;
  subtitle?: string;
  priceKrw: number;
  isRecommended?: boolean;
  isUnlimited?: boolean;
  benefitLines?: string[];
};

export type EsimCountryDetailInfo = {
  network?: string;
  hotspot?: string;
  activation?: string;
  startPolicy?: string;
  deviceCheckLabel?: string;
};

export type EsimPlanTemplate = {
  tierKey: string;
  title: string;
  subtitle?: string;
  basePrice: number;
  perDay: number;
  isRecommended?: boolean;
  isUnlimited?: boolean;
  benefitLines?: string[];
};

export type EsimCountryDetail = {
  code: string;
  nameKr: string;
  flag: string;
  heroImage: string;
  heroAlt?: string;
  serviceTagline?: string;
  reviewRating?: number;
  reviewCount?: number;
  reviewChips?: string[];
  durations: number[];
  info: EsimCountryDetailInfo;
  planTemplates: EsimPlanTemplate[];
};

/** Funnel coverage 상품 → 상세 URL에 실어 두고, 기간 변경 시 checkout용 cov id를 다시 만든다. */
export type ProductCovContext = {
  productId: string;
  network: NetworkType;
  countryCodes: string[];
};

export type ProductPageModel = {
  detail: EsimCountryDetail;
  initialDuration: number;
  initialPlanId: string | null;
  covContext?: ProductCovContext;
};
