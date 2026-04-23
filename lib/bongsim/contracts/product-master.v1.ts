import type {
  ExcelSheetLanguage,
  NetworkFamily,
  PlanLineExcel,
  PlanType,
} from "@/lib/bongsim/contracts/public-enums";

/** Six-cell supplier price snapshot; keys are stable for charged_basis selection. */
export type BongsimPriceBlockV1 = {
  before: {
    consumer_krw: number | null;
    recommended_krw: number | null;
    supply_krw: number | null;
  };
  after: {
    consumer_krw: number | null;
    recommended_krw: number | null;
    supply_krw: number | null;
  };
};

export type BongsimProductFlagsV1 = {
  kyc: string;
  hotspot: string;
  esim: string;
  usim: string;
  request_shipment: string;
  status_check: string;
  extension_iccid_topup: string;
};

/**
 * SSOT SKU row (one purchasable option = one `option_api_id`).
 * Mirrors `bongsim_product_option` with JSON columns typed at the edge.
 */
export type BongsimProductOptionV1 = {
  option_api_id: string;
  vendor_code: string;
  sim_kind: string;
  excel_update_type: string | null;
  excel_sheet: string;
  excel_sheet_language: ExcelSheetLanguage;
  plan_line_excel: PlanLineExcel;
  network_family: NetworkFamily;
  plan_type: PlanType;
  plan_name: string;
  days_raw: string;
  allowance_label: string;
  option_label: string;
  carrier_raw: string | null;
  data_class_raw: string | null;
  network_raw: string | null;
  internet_raw: string | null;
  qos_raw: string | null;
  validity_raw: string | null;
  apn_raw: string | null;
  install_benchmark_raw: string | null;
  activation_policy_raw: string | null;
  mcc_raw: string | null;
  mnc_raw: string | null;
  flags: BongsimProductFlagsV1;
  price_block: BongsimPriceBlockV1;
  /** Lossless ingest payload for audit; never UI-normalize away strings. */
  raw_row: Record<string, unknown>;
  classification_conflict: boolean;
  classification_notes: string | null;
  created_at: string;
  updated_at: string;
};
