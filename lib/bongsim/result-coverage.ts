import type { CountryOption, EsimCoverageDurationOption, EsimCoverageProduct, EsimProductTypeOption, MockPlan, NetworkType } from "./types";

export type ResultCoverageDeps = {
  getCountryById: (id: string) => CountryOption | undefined;
  listPlansForSelection: (input: {
    countryId: string;
    network: NetworkType;
    tripDays: number;
  }) => MockPlan[];
};

export type EsimCoverageComputeInput = {
  selectedCountryCodes: string[];
  durationDays: number;
  tripStart?: string | null;
  tripEnd?: string | null;
};

const TRIP_LENGTH_CANDIDATES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const COMPARISON_INTEGRATED_COUNTRY_CODES = new Set([
  "jp",
  "th",
  "vn",
  "tw",
  "hk",
  "my",
  "sg",
]);

const COMPARISON_GLOBAL_151_COUNTRY_CODES = new Set([
  "jp",
  "th",
  "vn",
  "tw",
  "hk",
  "my",
  "sg",
  "id",
  "ph",
  "au",
  "nz",
  "cn",
  "mo",
]);

const COMPARISON_INTEGRATED_PRICE_FACTOR = 0.92;

const GLOBAL_151_RM_BASE = 32000;
const GLOBAL_151_RM_PER_DAY = 1200;
const GLOBAL_151_LC_BASE = 36000;
const GLOBAL_151_LC_PER_DAY = 1300;

function allInSet(codes: string[], set: Set<string>): boolean {
  return codes.length > 0 && codes.every((c) => set.has(c));
}

export function minPlanPriceForTrip(
  deps: ResultCoverageDeps,
  countryId: string,
  tripDays: number,
  net: NetworkType,
): number {
  const plans = deps.listPlansForSelection({ countryId, network: net, tripDays });
  if (plans.length === 0) return Number.POSITIVE_INFINITY;
  return plans[0]!.priceKrw;
}

export function bundleSumForTrip(
  deps: ResultCoverageDeps,
  codes: string[],
  tripDays: number,
  net: NetworkType,
): number {
  return codes.reduce((s, c) => s + minPlanPriceForTrip(deps, c, tripDays, net), 0);
}

export function networkOptionsForTrip(
  deps: ResultCoverageDeps,
  codes: string[],
  tripDays: number,
): EsimProductTypeOption[] {
  const hasRm = codes.every(
    (c) => deps.listPlansForSelection({ countryId: c, network: "roaming", tripDays }).length > 0,
  );
  const hasLc = codes.every(
    (c) => deps.listPlansForSelection({ countryId: c, network: "local", tripDays }).length > 0,
  );
  const out: EsimProductTypeOption[] = [];
  if (hasRm) {
    out.push({
      networkType: "roaming",
      label: "로밍형",
      helperText: "여러 국가 이동에 유리한 방식이에요.",
      startingPrice: bundleSumForTrip(deps, codes, tripDays, "roaming"),
    });
  }
  if (hasLc) {
    out.push({
      networkType: "local",
      label: "현지망형",
      helperText: "현지 네트워크 중심으로 쓰는 방식이에요.",
      startingPrice: bundleSumForTrip(deps, codes, tripDays, "local"),
    });
  }
  return out;
}

function priceAtDuration(opts: EsimCoverageDurationOption[], durationDays: number): number | null {
  const m = opts.find((o) => o.days === durationDays);
  return m != null ? m.price : null;
}

function buildIndividualDurationOptions(deps: ResultCoverageDeps, singles: string[]): EsimCoverageDurationOption[] {
  const out: EsimCoverageDurationOption[] = [];
  for (const d of TRIP_LENGTH_CANDIDATES) {
    const opts = networkOptionsForTrip(deps, singles, d);
    if (opts.length === 0) continue;
    const p = Math.min(
      ...opts.map((o) => (o.startingPrice != null ? o.startingPrice : Number.POSITIVE_INFINITY)),
    );
    if (!Number.isFinite(p)) continue;
    out.push({ days: d, price: p });
  }
  return out;
}

function buildIntegratedDurationOptions(deps: ResultCoverageDeps, singles: string[]): EsimCoverageDurationOption[] {
  const out: EsimCoverageDurationOption[] = [];
  for (const d of TRIP_LENGTH_CANDIDATES) {
    if (singles.length < 2 || !allInSet(singles, COMPARISON_INTEGRATED_COUNTRY_CODES)) continue;
    const baseOpts = networkOptionsForTrip(deps, singles, d);
    if (baseOpts.length === 0) continue;
    const prices: number[] = [];
    if (baseOpts.some((o) => o.networkType === "roaming")) {
      prices.push(Math.floor(bundleSumForTrip(deps, singles, d, "roaming") * COMPARISON_INTEGRATED_PRICE_FACTOR));
    }
    if (baseOpts.some((o) => o.networkType === "local")) {
      prices.push(Math.floor(bundleSumForTrip(deps, singles, d, "local") * COMPARISON_INTEGRATED_PRICE_FACTOR));
    }
    if (prices.length === 0) continue;
    out.push({ days: d, price: Math.min(...prices) });
  }
  return out;
}

function buildGlobal151DurationOptions(singles: string[]): EsimCoverageDurationOption[] {
  const out: EsimCoverageDurationOption[] = [];
  if (!allInSet(singles, COMPARISON_GLOBAL_151_COUNTRY_CODES)) return out;
  for (const d of TRIP_LENGTH_CANDIDATES) {
    const gRm = GLOBAL_151_RM_BASE + d * GLOBAL_151_RM_PER_DAY;
    const gLc = GLOBAL_151_LC_BASE + d * GLOBAL_151_LC_PER_DAY;
    out.push({ days: d, price: Math.min(gRm, gLc) });
  }
  return out;
}

function buildRegionDurationOptions(deps: ResultCoverageDeps, regionId: string): EsimCoverageDurationOption[] {
  return buildIndividualDurationOptions(deps, [regionId]);
}

function availableNetworksAtDay(
  deps: ResultCoverageDeps,
  rowId: string,
  singles: string[],
  durationDays: number,
): EsimProductTypeOption[] {
  if (rowId === "glob151") {
    const gRm = GLOBAL_151_RM_BASE + durationDays * GLOBAL_151_RM_PER_DAY;
    const gLc = GLOBAL_151_LC_BASE + durationDays * GLOBAL_151_LC_PER_DAY;
    return [
      { networkType: "roaming", label: "로밍형", helperText: "광역 커버 상품.", startingPrice: gRm },
      { networkType: "local", label: "현지망형", helperText: "광역 커버 상품.", startingPrice: gLc },
    ];
  }
  if (rowId === "integr") {
    const base = networkOptionsForTrip(deps, singles, durationDays);
    const out: EsimProductTypeOption[] = [];
    if (base.some((o) => o.networkType === "roaming")) {
      out.push({
        networkType: "roaming",
        label: "로밍형",
        helperText: "통합 상품으로 한 번에 관리해요.",
        startingPrice: Math.floor(bundleSumForTrip(deps, singles, durationDays, "roaming") * COMPARISON_INTEGRATED_PRICE_FACTOR),
      });
    }
    if (base.some((o) => o.networkType === "local")) {
      out.push({
        networkType: "local",
        label: "현지망형",
        helperText: "통합 상품으로 한 번에 관리해요.",
        startingPrice: Math.floor(bundleSumForTrip(deps, singles, durationDays, "local") * COMPARISON_INTEGRATED_PRICE_FACTOR),
      });
    }
    return out;
  }
  return networkOptionsForTrip(deps, singles, durationDays);
}

export function priceForCoverageRow(
  deps: ResultCoverageDeps,
  row: EsimCoverageProduct,
  network: NetworkType,
  tripDays: number,
  countryCodes: string[],
): number {
  const opt = row.availableNetworkTypes.find((o) => o.networkType === network);
  if (opt?.startingPrice != null) return opt.startingPrice;
  if (row.id === "indiv") return bundleSumForTrip(deps, countryCodes, tripDays, network);
  if (row.id === "integr") {
    return Math.floor(bundleSumForTrip(deps, countryCodes, tripDays, network) * COMPARISON_INTEGRATED_PRICE_FACTOR);
  }
  if (row.id === "glob151") {
    return network === "roaming"
      ? GLOBAL_151_RM_BASE + tripDays * GLOBAL_151_RM_PER_DAY
      : GLOBAL_151_LC_BASE + tripDays * GLOBAL_151_LC_PER_DAY;
  }
  if (row.id === "region") {
    return minPlanPriceForTrip(deps, countryCodes[0]!, tripDays, network);
  }
  return row.startingPrice;
}

export function computeEsimCoverageResults(
  deps: ResultCoverageDeps,
  input: EsimCoverageComputeInput,
): EsimCoverageProduct[] {
  const ids = [...new Set(input.selectedCountryCodes)].filter((c) => c && c !== "kr");
  const durationDays = input.durationDays;
  if (ids.length === 0 || durationDays < 1) return [];

  const regionId = ids.find((c) => {
    const co = deps.getCountryById(c);
    return co?.isRegion || c.startsWith("rg-");
  });
  if (regionId) {
    const co = deps.getCountryById(regionId);
    if (!co) return [];
    const durationOptions = buildRegionDurationOptions(deps, regionId);
    const p = priceAtDuration(durationOptions, durationDays);
    if (p == null) return [];
    const availableNetworkTypes = availableNetworksAtDay(deps, "region", [regionId], durationDays);
    if (availableNetworkTypes.length === 0) return [];
    const row: EsimCoverageProduct = {
      id: "region",
      coverageType: "global",
      countryCodes: [regionId],
      title: `${co.nameKr} ${co.subtitleKr ?? ""}`.trim(),
      subtitle: "지역·패키지 단위 상품이에요.",
      coverageSummaryKr: "선택한 광역·패키지 코드 기준 커버",
      whyKr: "다국가 탭에서 고른 지역 상품 하나로 이어져요.",
      startingPrice: p,
      durationOptions,
      availableNetworkTypes,
      coversAllSelected: true,
    };
    row.isBestPrice = true;
    return [row];
  }

  const singles = ids.filter((c) => deps.getCountryById(c));
  if (singles.length === 0) return [];

  const rows: EsimCoverageProduct[] = [];

  const indivDurationOptions = buildIndividualDurationOptions(deps, singles);
  const indivPrice = priceAtDuration(indivDurationOptions, durationDays);
  if (indivPrice != null) {
    const availableNetworkTypes = availableNetworksAtDay(deps, "indiv", singles, durationDays);
    if (availableNetworkTypes.length > 0) {
      rows.push({
        id: "indiv",
        coverageType: "single",
        countryCodes: singles,
        title: "선택 국가 조합",
        subtitle: "국가마다 맞는 요금제를 골라 합산한 금액이에요.",
        coverageSummaryKr: `${singles.length}개 목적지 · 국가별 데이터 eSIM 합산`,
        whyKr: "나라마다 다른 요금·망 조건을 그대로 반영한 조합이에요.",
        startingPrice: indivPrice,
        durationOptions: indivDurationOptions,
        availableNetworkTypes,
        coversAllSelected: false,
      });
    }
  }

  const integDurationOptions = buildIntegratedDurationOptions(deps, singles);
  const integPrice = priceAtDuration(integDurationOptions, durationDays);
  if (integPrice != null) {
    const integAvailable = availableNetworksAtDay(deps, "integr", singles, durationDays);
    if (integAvailable.length > 0) {
      rows.push({
        id: "integr",
        coverageType: "multi",
        countryCodes: singles,
        title: "통합형 상품",
        subtitle: "한 장의 eSIM으로 선택 국가를 함께 커버하는 상품이 있을 때의 견적이에요.",
        coverageSummaryKr: `${singles.length}개국 통합 요금(카탈로그 규칙 충족 시만)`,
        whyKr: "선택한 국가 조합이 통합 SKU 조건을 만족할 때만 표시돼요.",
        startingPrice: integPrice,
        durationOptions: integDurationOptions,
        availableNetworkTypes: integAvailable,
        coversAllSelected: true,
      });
    }
  }

  const globDurationOptions = buildGlobal151DurationOptions(singles);
  const globPrice = priceAtDuration(globDurationOptions, durationDays);
  if (globPrice != null) {
    const globAvailable = availableNetworksAtDay(deps, "glob151", singles, durationDays);
    rows.push({
      id: "glob151",
      coverageType: "global",
      countryCodes: singles,
      title: "글로벌 상품",
      subtitle: "151개국 광역 패스로 선택 국가를 모두 덮을 때의 견적이에요.",
      coverageSummaryKr: "광역 커버리지 · 선택 국가 전원 포함 검증됨",
      whyKr: "선택한 모든 국가가 글로벌 패스 커버 집합에 포함될 때만 노출돼요.",
      startingPrice: globPrice,
      durationOptions: globDurationOptions,
      availableNetworkTypes: globAvailable,
      coversAllSelected: true,
    });
  }

  rows.sort((a, b) => a.startingPrice - b.startingPrice);

  const minPrice = rows.length > 0 ? Math.min(...rows.map((r) => r.startingPrice)) : 0;
  let assigned = false;
  for (const r of rows) {
    if (!assigned && r.startingPrice === minPrice) {
      r.isBestPrice = true;
      assigned = true;
    } else {
      r.isBestPrice = false;
    }
  }

  return rows;
}
