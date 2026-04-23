import { COUNTRY_OPTIONS } from "./country-options";
import { EMPTY_FUNNEL, FUNNEL_STORAGE_KEY, ORDERS_STORAGE_KEY, withTripScheduleDerived } from "./constants";
import {
  getEsimCountryDetailOrFallback,
  getEsimPlansForDuration,
  parseEsimPlanId,
  snapDuration,
} from "./esim-detail";
import { REGION_PACK_OPTIONS } from "./region-packs";
import { computeEsimCoverageResults, priceForCoverageRow, type ResultCoverageDeps } from "./result-coverage";
import type {
  CountryOption,
  EsimCoverageProduct,
  FunnelState,
  MockOrder,
  MockPlan,
  NetworkType,
  ProductCovContext,
  ProductPageModel,
} from "./types";

export const MOCK_COUNTRIES = COUNTRY_OPTIONS;

export const MOCK_PLANS: MockPlan[] = [
  {
    id: "jp-rm-7",
    countryId: "jp",
    nameKo: "일본 로밍 7일 10GB",
    dataSummaryKo: "10GB / 7일",
    validityDays: 7,
    priceKrw: 29000,
    networkTypes: ["roaming"],
    highlightsKo: ["주요 도시 커버", "개통 문자 안내", "데이터 전용"],
  },
  {
    id: "jp-lc-10",
    countryId: "jp",
    nameKo: "일본 현지망 10일 무제한(정책형)",
    dataSummaryKo: "무제한(공정이용) / 10일",
    validityDays: 10,
    priceKrw: 35000,
    networkTypes: ["local"],
    highlightsKo: ["현지 네트워크", "여행 일정 길 때 추천", "설치 가이드 동봉"],
  },
  {
    id: "th-rm-5",
    countryId: "th",
    nameKo: "태국 로밍 5일 8GB",
    dataSummaryKo: "8GB / 5일",
    validityDays: 5,
    priceKrw: 22000,
    networkTypes: ["roaming"],
    highlightsKo: ["방콕·푸켓 일정에 맞춤", "빠른 개통"],
  },
  {
    id: "th-lc-8",
    countryId: "th",
    nameKo: "태국 현지망 8일 15GB",
    dataSummaryKo: "15GB / 8일",
    validityDays: 8,
    priceKrw: 26000,
    networkTypes: ["local"],
    highlightsKo: ["현지망 안정감", "SNS·지도 여유"],
  },
  {
    id: "vn-rm-6",
    countryId: "vn",
    nameKo: "베트남 로밍 6일 12GB",
    dataSummaryKo: "12GB / 6일",
    validityDays: 6,
    priceKrw: 24000,
    networkTypes: ["roaming"],
    highlightsKo: ["다낭·호치민", "출발 전 미리 준비"],
  },
  {
    id: "vn-lc-9",
    countryId: "vn",
    nameKo: "베트남 현지망 9일 20GB",
    dataSummaryKo: "20GB / 9일",
    validityDays: 9,
    priceKrw: 31000,
    networkTypes: ["local"],
    highlightsKo: ["긴 일정용 데이터", "현지 체감 품질"],
  },
];

function parseSyntheticPlanId(id: string): MockPlan | null {
  const p = id.split("|");
  if (p.length === 4 && p[0] === "syn") {
    const net: NetworkType = p[1] === "rm" ? "roaming" : "local";
    const code = p[2];
    const vd = Number(p[3]);
    if (!Number.isFinite(vd) || vd < 1) return null;
    const country = getCountryById(code);
    if (!country) return null;
    return buildSyntheticPlan(country, net, vd);
  }
  const legacy = id.match(/^syn-(rm|lc)-([a-z]{2})-(\d+)$/);
  if (legacy) {
    const net: NetworkType = legacy[1] === "rm" ? "roaming" : "local";
    const code = legacy[2];
    const vd = Number(legacy[3]);
    const country = getCountryById(code);
    if (!country) return null;
    return buildSyntheticPlan(country, net, vd);
  }
  return null;
}

function buildSyntheticPlan(
  country: CountryOption,
  network: NetworkType,
  validityDays: number,
): MockPlan {
  const tag = network === "roaming" ? "rm" : "lc";
  const id = ["syn", tag, country.code, String(validityDays)].join("|");
  const isRm = network === "roaming";
  const label = country.subtitleKr ? `${country.nameKr} / ${country.subtitleKr}` : country.nameKr;
  return {
    id,
    countryId: country.code,
    nameKo: isRm
      ? `${label} 로밍 ${validityDays}일 10GB`
      : `${label} 현지망 ${validityDays}일 15GB`,
    dataSummaryKo: isRm ? `10GB / ${validityDays}일` : `15GB / ${validityDays}일`,
    validityDays,
    priceKrw: isRm ? 15000 + validityDays * 900 : 19000 + validityDays * 1100,
    networkTypes: [network],
    highlightsKo: isRm
      ? ["데이터 전용", "여행 기간에 맞춤"]
      : ["현지 네트워크", "지도·SNS 여유"],
  };
}

export function getCountryById(id: string): CountryOption | undefined {
  return MOCK_COUNTRIES.find((c) => c.code === id) ?? REGION_PACK_OPTIONS.find((c) => c.code === id);
}

function getPlanByIdDirect(id: string): MockPlan | undefined {
  const direct = MOCK_PLANS.find((p) => p.id === id);
  if (direct) return direct;
  return parseSyntheticPlanId(id) ?? undefined;
}

function mockPlanFromEsimId(id: string): MockPlan | undefined {
  const parsed = parseEsimPlanId(id);
  if (!parsed) return undefined;
  const country = getCountryById(parsed.code);
  if (!country) return undefined;
  const detail = getEsimCountryDetailOrFallback(country);
  const d = snapDuration(detail.durations, parsed.duration);
  const plans = getEsimPlansForDuration(detail, d);
  const opt = plans.find((p) => p.tierKey === parsed.tierKey);
  if (!opt) return undefined;
  return {
    id,
    countryId: detail.code,
    nameKo: `${detail.nameKr} eSIM · ${opt.title}`,
    dataSummaryKo: opt.subtitle ?? `${d}일`,
    validityDays: d,
    priceKrw: opt.priceKrw,
    networkTypes: ["roaming"],
    highlightsKo:
      opt.benefitLines && opt.benefitLines.length > 0
        ? [...opt.benefitLines]
        : ["데이터 전용", "eSIM 등록 안내"],
  };
}

export function getPlanById(id: string): MockPlan | undefined {
  return getPlanByIdDirect(id) ?? planFromCovId(id) ?? mockPlanFromEsimId(id);
}

export function resolveProductPage(id: string): ProductPageModel | null {
  const parsedEsim = parseEsimPlanId(id);
  if (parsedEsim) {
    const country = getCountryById(parsedEsim.code);
    if (!country) return null;
    const detail = getEsimCountryDetailOrFallback(country);
    const d0 = snapDuration(detail.durations, parsedEsim.duration);
    const plans = getEsimPlansForDuration(detail, d0);
    const opt =
      plans.find((p) => p.tierKey === parsedEsim.tierKey) ??
      plans.find((p) => p.isRecommended) ??
      plans[0];
    return { detail, initialDuration: d0, initialPlanId: opt?.id ?? null };
  }

  const covParsed = parseCovPlanId(id);
  if (covParsed) {
    const network: NetworkType = covParsed.netTag === "rm" ? "roaming" : "local";
    const countryCodes = covParsed.codesKey.split("-").filter(Boolean);
    const primary = countryCodes[0];
    const country = primary ? getCountryById(primary) : undefined;
    if (!country) return null;
    const detail = getEsimCountryDetailOrFallback(country);
    const d0 = snapDuration(detail.durations, covParsed.tripDays);
    const initialPlanId = encodeCovPlanId(covParsed.productId, network, d0, countryCodes);
    const covContext: ProductCovContext = {
      productId: covParsed.productId,
      network,
      countryCodes,
    };
    return { detail, initialDuration: d0, initialPlanId, covContext };
  }

  const legacy = getPlanByIdDirect(id);
  if (legacy) {
    const country = getCountryById(legacy.countryId);
    if (!country) return null;
    const detail = getEsimCountryDetailOrFallback(country);
    const d0 = snapDuration(detail.durations, legacy.validityDays);
    const plans = getEsimPlansForDuration(detail, d0);
    const match =
      plans.find((p) => Math.abs(p.priceKrw - legacy.priceKrw) < 1) ??
      plans.find((p) => p.isRecommended) ??
      plans[0];
    return { detail, initialDuration: d0, initialPlanId: match?.id ?? null };
  }

  const countryOnly = getCountryById(id);
  if (!countryOnly || countryOnly.code === "kr") return null;
  const detail = getEsimCountryDetailOrFallback(countryOnly);
  const d0 = detail.durations.includes(4) ? 4 : (detail.durations[0] ?? 5);
  const plans = getEsimPlansForDuration(detail, d0);
  const pick = plans.find((p) => p.isRecommended) ?? plans[0];
  return { detail, initialDuration: d0, initialPlanId: pick?.id ?? null };
}

export function listPlansForSelection(input: {
  countryId: string;
  network: NetworkType;
  tripDays: number;
}): MockPlan[] {
  const base = MOCK_PLANS.filter(
    (p) =>
      p.countryId === input.countryId && p.networkTypes.includes(input.network),
  );
  if (base.length > 0) {
    return [...base].sort((a, b) => {
      const da = Math.abs(a.validityDays - input.tripDays);
      const db = Math.abs(b.validityDays - input.tripDays);
      if (da !== db) return da - db;
      return a.priceKrw - b.priceKrw;
    });
  }
  const country = getCountryById(input.countryId);
  if (!country) return [];
  const vd = Math.max(3, Math.min(14, input.tripDays));
  const roaming = buildSyntheticPlan(country, "roaming", vd);
  const local = buildSyntheticPlan(country, "local", vd);
  const pool = [roaming, local].filter((p) => p.networkTypes.includes(input.network));
  return [...pool].sort((a, b) => {
    const da = Math.abs(a.validityDays - input.tripDays);
    const db = Math.abs(b.validityDays - input.tripDays);
    if (da !== db) return da - db;
    return a.priceKrw - b.priceKrw;
  });
}

function sortedCodesKey(codes: string[]): string {
  return [...new Set(codes)].filter(Boolean).sort().join("-");
}

function resultCoverageDeps(): ResultCoverageDeps {
  return { getCountryById, listPlansForSelection };
}

export function buildComparisonRows(countryIds: string[], tripDays: number): EsimCoverageProduct[] {
  return computeEsimCoverageResults(resultCoverageDeps(), {
    selectedCountryCodes: countryIds,
    durationDays: tripDays,
  });
}

export function encodeCovPlanId(
  productId: string,
  network: NetworkType,
  tripDays: number,
  countryCodes: string[],
): string {
  const tag = network === "roaming" ? "rm" : "lc";
  return `cov__${productId}__${tag}__${tripDays}__${sortedCodesKey(countryCodes)}`;
}

export function parseCovPlanId(
  id: string,
): { productId: string; netTag: "rm" | "lc"; tripDays: number; codesKey: string } | null {
  const m = id.match(/^cov__([a-z0-9-]+)__(rm|lc)__(\d+)__([a-z0-9-]+)$/i);
  if (!m) return null;
  const tripDays = Number(m[3]);
  if (!Number.isFinite(tripDays) || tripDays < 1) return null;
  return { productId: m[1], netTag: m[2] as "rm" | "lc", tripDays, codesKey: m[4] };
}

function priceForCoverageProduct(
  row: EsimCoverageProduct,
  network: NetworkType,
  tripDays: number,
  countryCodes: string[],
): number {
  return priceForCoverageRow(resultCoverageDeps(), row, network, tripDays, countryCodes);
}

function planFromCovId(id: string): MockPlan | undefined {
  const parsed = parseCovPlanId(id);
  if (!parsed) return undefined;
  const network: NetworkType = parsed.netTag === "rm" ? "roaming" : "local";
  const countryCodes = parsed.codesKey.split("-").filter(Boolean);
  if (countryCodes.length === 0) return undefined;
  const rows = buildComparisonRows(countryCodes, parsed.tripDays);
  const row = rows.find((r) => r.id === parsed.productId);
  if (!row) return undefined;
  const price = priceForCoverageProduct(row, network, parsed.tripDays, countryCodes);
  const netLabel = network === "roaming" ? "로밍형" : "현지망형";
  return {
    id,
    countryId: countryCodes[0]!,
    nameKo: `${row.title} · ${netLabel} · ${parsed.tripDays}일`,
    dataSummaryKo: row.subtitle ?? "",
    validityDays: parsed.tripDays,
    priceKrw: price,
    networkTypes: [network],
    highlightsKo: [
      row.coverageType === "single" ? "국가별 요금 합산" : "봉SIM eSIM",
      netLabel,
    ],
  };
}

export function tripDayCount(start: string, end: string): number {
  const parse = (v: string) => {
    const [y, m, d] = v.split("-").map((n) => Number(n));
    return new Date(y, m - 1, d);
  };
  const s = parse(start);
  const e = parse(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) {
    return 1;
  }
  const ms = e.getTime() - s.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

export function loadFunnel(): FunnelState {
  if (typeof window === "undefined") return { ...EMPTY_FUNNEL };
  try {
    const raw = window.sessionStorage.getItem(FUNNEL_STORAGE_KEY);
    if (!raw) return { ...EMPTY_FUNNEL };
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    let countryIds: string[] = [];
    if (Array.isArray(parsed.countryIds)) {
      countryIds = (parsed.countryIds as unknown[]).filter(
        (c): c is string => typeof c === "string" && c !== "kr" && !!getCountryById(c),
      );
    }
    const legacy = parsed.countryId;
    if (countryIds.length === 0 && typeof legacy === "string" && legacy !== "kr" && getCountryById(legacy)) {
      countryIds = [legacy];
    }

    const base: FunnelState = {
      countryIds,
      tripStart: typeof parsed.tripStart === "string" ? parsed.tripStart : null,
      tripEnd: typeof parsed.tripEnd === "string" ? parsed.tripEnd : null,
      tripDurationDays: typeof parsed.tripDurationDays === "number" ? parsed.tripDurationDays : null,
      tripDurationNights: typeof parsed.tripDurationNights === "number" ? parsed.tripDurationNights : null,
      network: (parsed.network as NetworkType | null) ?? null,
      planId: (parsed.planId as string | null) ?? null,
      coverageProductId: (parsed.coverageProductId as string | null) ?? null,
    };
    return withTripScheduleDerived(base);
  } catch {
    return { ...EMPTY_FUNNEL };
  }
}

export function saveFunnel(state: FunnelState): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(withTripScheduleDerived(state)));
}

export function clearFunnel(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(FUNNEL_STORAGE_KEY);
}

function readOrders(): Record<string, MockOrder> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, MockOrder>;
  } catch {
    return {};
  }
}

function writeOrders(map: Record<string, MockOrder>): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(map));
}

export function saveOrder(order: MockOrder): void {
  const map = readOrders();
  map[order.orderId] = order;
  writeOrders(map);
}

export function getOrder(orderId: string): MockOrder | undefined {
  return readOrders()[orderId];
}
