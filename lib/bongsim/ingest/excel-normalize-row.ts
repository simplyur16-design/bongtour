import type { BongsimProductOptionV1 } from "@/lib/bongsim/contracts/product-master.v1";
import type { BongsimPriceBlockV1, BongsimProductFlagsV1 } from "@/lib/bongsim/contracts/product-master.v1";
import type { ExcelSheetLanguage, NetworkFamily, PlanLineExcel, PlanType } from "@/lib/bongsim/contracts/public-enums";
import { BONGSIM_EXCEL_COLUMN_MAP } from "@/lib/bongsim/ingest/excel-map-columns";
import type { BongsimExcelSourceMetaV1 } from "@/lib/bongsim/ingest/excel-sheet-config";

export type { BongsimExcelSourceMetaV1 } from "@/lib/bongsim/ingest/excel-sheet-config";

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  const s = String(v).replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function pickFromRecord(rec: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    if (!k) continue;
    const v = rec[k];
    const s = str(v);
    if (s) return s;
  }
  return "";
}

function headerCandidates(lang: ExcelSheetLanguage, key: keyof typeof BONGSIM_EXCEL_COLUMN_MAP.ko): string[] {
  const ko = BONGSIM_EXCEL_COLUMN_MAP.ko[key];
  const enRec = BONGSIM_EXCEL_COLUMN_MAP.en as Record<string, string | undefined>;
  const en = enRec[key as string];
  const extra: string[] = [];
  if (key === "request_shipment") {
    extra.push(BONGSIM_EXCEL_COLUMN_MAP.en.request_shipment_alt);
  }
  if (key === "status_check") {
    extra.push(BONGSIM_EXCEL_COLUMN_MAP.en.status_check_alt);
  }
  if (key === "days") {
    extra.push(BONGSIM_EXCEL_COLUMN_MAP.en.days_fix);
  }
  if (lang === "ko") {
    if (key === "consumer_after") {
      extra.push("(변경)소비자가(KRW)", "변경 소비자가(KRW)", "변경_소비자가(KRW)");
    }
    if (key === "recommended_after") {
      extra.push("(변경)권장판매가(KRW)", "변경 권장판매가(KRW)", "변경_권장판매가(KRW)");
    }
    if (key === "supply_after") {
      extra.push("(변경)공급가(KRW)", "변경 공급가(KRW)", "변경_공급가(KRW)");
    }
  }
  const set = new Set<string>();
  [ko, en, ...extra].forEach((x) => {
    if (x) set.add(x);
  });
  return [...set];
}

function cell(rec: Record<string, unknown>, lang: ExcelSheetLanguage, key: keyof typeof BONGSIM_EXCEL_COLUMN_MAP.ko): string {
  return pickFromRecord(rec, headerCandidates(lang, key));
}

/** 행에 한글 `플랜명` 열이 있으면 우선(영문 시트와 병행 시 한글 plan_name 유지). */
function cellPlanName(rec: Record<string, unknown>, lang: ExcelSheetLanguage): string {
  const fromKo = pickFromRecord(rec, headerCandidates("ko", "plan_name"));
  if (fromKo) return fromKo;
  return cell(rec, lang, "plan_name");
}

function numFromHeaders(rec: Record<string, unknown>, lang: ExcelSheetLanguage, key: keyof typeof BONGSIM_EXCEL_COLUMN_MAP.ko): number | null {
  for (const h of headerCandidates(lang, key)) {
    const n = numOrNull(rec[h]);
    if (n != null) return n;
  }
  return null;
}

function buildPriceBlock(rec: Record<string, unknown>, lang: ExcelSheetLanguage): BongsimPriceBlockV1 {
  const c = (k: keyof typeof BONGSIM_EXCEL_COLUMN_MAP.ko) => numFromHeaders(rec, lang, k);
  return {
    before: {
      consumer_krw: c("consumer_before"),
      recommended_krw: c("recommended_before"),
      supply_krw: c("supply_before"),
    },
    after: {
      consumer_krw: c("consumer_after"),
      recommended_krw: c("recommended_after"),
      supply_krw: c("supply_after"),
    },
  };
}

function buildFlags(rec: Record<string, unknown>, lang: ExcelSheetLanguage): BongsimProductFlagsV1 {
  const f = (k: keyof typeof BONGSIM_EXCEL_COLUMN_MAP.ko) => {
    const s = cell(rec, lang, k);
    return s.length ? s : "—";
  };
  return {
    kyc: f("kyc"),
    hotspot: f("hotspot"),
    esim: f("esim"),
    usim: f("usim"),
    request_shipment: f("request_shipment"),
    status_check: f("status_check"),
    extension_iccid_topup: f("extension"),
  };
}

function planTypeFromLine(pl: PlanLineExcel): PlanType {
  if (pl === "로컬") return null;
  if (pl === "무제한") return "unlimited";
  if (pl === "종량제") return "fixed";
  return "daily";
}

function inferNetworkFromInternet(raw: string): NetworkFamily | null {
  const s = raw.toLowerCase();
  if (!raw.trim()) return null;
  if (s.includes("local") || raw.includes("로컬")) return "local";
  if (s.includes("roaming") || raw.includes("로밍")) return "roaming";
  return null;
}

/**
 * Map a single header-aligned row record (keys = exact Excel header strings) + ingest metadata → SKU row.
 */
export function normalizeExcelRow(meta: BongsimExcelSourceMetaV1, rec: Record<string, unknown>): BongsimProductOptionV1 {
  const lang = meta.sheet_language;
  const plan_line_excel = meta.plan_line_excel;

  const option_api_id = cell(rec, lang, "option_api_id");
  const vendor_code = cell(rec, lang, "vendor_code");
  const sim_kind = cell(rec, lang, "sim_type");

  const internet_raw = cell(rec, lang, "internet");
  const expected_nf: NetworkFamily = plan_line_excel === "로컬" ? "local" : "roaming";
  const inferred = inferNetworkFromInternet(internet_raw);
  const network_family: NetworkFamily = inferred ?? expected_nf;
  const classification_conflict = inferred !== null && inferred !== expected_nf;
  const classification_notes = classification_conflict
    ? `망(${internet_raw})과 시트 라인(${plan_line_excel}) 기대 망(${expected_nf}) 불일치`
    : null;

  const plan_type = planTypeFromLine(plan_line_excel);
  const now = new Date().toISOString();

  const price_block = buildPriceBlock(rec, lang);
  const flags = buildFlags(rec, lang);

  return {
    option_api_id,
    vendor_code: vendor_code || "—",
    sim_kind: sim_kind || "—",
    excel_update_type: cell(rec, lang, "update_type") || null,
    excel_sheet: meta.sheet_name,
    excel_sheet_language: lang,
    plan_line_excel,
    network_family,
    plan_type,
    plan_name: cellPlanName(rec, lang) || "—",
    days_raw: cell(rec, lang, "days") || "—",
    allowance_label: cell(rec, lang, "allowance") || "—",
    option_label: cell(rec, lang, "option_name") || "—",
    carrier_raw: cell(rec, lang, "carrier") || null,
    data_class_raw: cell(rec, lang, "data_class") || null,
    network_raw: cell(rec, lang, "network") || null,
    internet_raw: internet_raw || null,
    qos_raw: cell(rec, lang, "qos") || null,
    validity_raw: cell(rec, lang, "validity") || null,
    apn_raw: cell(rec, lang, "apn") || null,
    install_benchmark_raw: cell(rec, lang, "install_benchmark") || null,
    activation_policy_raw: cell(rec, lang, "activation_policy") || null,
    mcc_raw: cell(rec, lang, "mcc") || null,
    mnc_raw: cell(rec, lang, "mnc") || null,
    flags,
    price_block,
    raw_row: { ...rec },
    classification_conflict,
    classification_notes,
    created_at: now,
    updated_at: now,
  };
}
