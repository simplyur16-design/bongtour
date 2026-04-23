import type { BongsimProductOptionV1 } from "@/lib/bongsim/contracts/product-master.v1";
import type { ExcelSheetLanguage, NetworkFamily, PlanLineExcel, PlanType } from "@/lib/bongsim/contracts/public-enums";
import type { BongsimProductOptionDbRow } from "@/lib/bongsim/data/bongsim-product-option-db-row";
import { parseFlagsJson, parsePriceBlockJson, parseRawRowJson } from "@/lib/bongsim/data/parse-product-json";

const PLAN_LINES = new Set<PlanLineExcel>(["로컬", "무제한", "종량제", "데일리"]);
const LANGS = new Set<ExcelSheetLanguage>(["ko", "en"]);
const ROAMING_PLAN_TYPES = new Set(["unlimited", "fixed", "daily"]);

function coercePlanLine(raw: string, networkFamilyRaw: string): { value: PlanLineExcel; fixed: boolean } {
  if (PLAN_LINES.has(raw as PlanLineExcel)) return { value: raw as PlanLineExcel, fixed: false };
  if (networkFamilyRaw === "local") return { value: "로컬", fixed: true };
  return { value: "데일리", fixed: true };
}

function coerceLang(raw: string): { value: ExcelSheetLanguage; fixed: boolean } {
  if (LANGS.has(raw as ExcelSheetLanguage)) return { value: raw as ExcelSheetLanguage, fixed: false };
  return { value: "ko", fixed: true };
}

function coerceNetworkFamily(raw: string): { value: NetworkFamily; fixed: boolean } {
  if (raw === "local" || raw === "roaming") return { value: raw, fixed: false };
  return { value: "roaming", fixed: true };
}

function coercePlanType(raw: string | null): { value: PlanType; fixed: boolean } {
  if (raw === null || raw === undefined || raw === "") return { value: null, fixed: false };
  if (ROAMING_PLAN_TYPES.has(raw)) return { value: raw as PlanType, fixed: false };
  return { value: null, fixed: true };
}

export function mapDbRowToProductOptionV1(row: BongsimProductOptionDbRow): BongsimProductOptionV1 {
  const planLine = coercePlanLine(row.plan_line_excel, row.network_family);
  const lang = coerceLang(row.excel_sheet_language);
  const nf = coerceNetworkFamily(row.network_family);
  const pt = coercePlanType(row.plan_type);
  const conflict =
    row.classification_conflict ||
    planLine.fixed ||
    lang.fixed ||
    nf.fixed ||
    pt.fixed;

  return {
    option_api_id: row.option_api_id,
    vendor_code: row.vendor_code,
    sim_kind: row.sim_kind,
    excel_update_type: row.excel_update_type,
    excel_sheet: row.excel_sheet,
    excel_sheet_language: lang.value,
    plan_line_excel: planLine.value,
    network_family: nf.value,
    plan_type: pt.value,
    plan_name: row.plan_name,
    days_raw: row.days_raw,
    allowance_label: row.allowance_label,
    option_label: row.option_label,
    carrier_raw: row.carrier_raw,
    data_class_raw: row.data_class_raw,
    network_raw: row.network_raw,
    internet_raw: row.internet_raw,
    qos_raw: row.qos_raw,
    validity_raw: row.validity_raw,
    apn_raw: row.apn_raw,
    install_benchmark_raw: row.install_benchmark_raw,
    activation_policy_raw: row.activation_policy_raw,
    mcc_raw: row.mcc_raw,
    mnc_raw: row.mnc_raw,
    flags: parseFlagsJson(row.flags),
    price_block: parsePriceBlockJson(row.price_block),
    raw_row: parseRawRowJson(row.raw_row),
    classification_conflict: conflict,
    classification_notes: row.classification_notes,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
