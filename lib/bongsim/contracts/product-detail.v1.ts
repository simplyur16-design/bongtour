import type { NetworkFamily, PlanLineExcel, PlanType } from "@/lib/bongsim/contracts/public-enums";

export type BongsimProductDetailPricingV1 = {
  currency: "KRW";
  display_amount_krw: number;
  /** Which supplier field key was chosen for storefront display (not recomputed). */
  display_basis: string;
};

export type BongsimProductDetailSummaryV1 = {
  plan_name: string;
  option_label: string;
  days_raw: string;
  allowance_label: string;
  network_family: NetworkFamily;
  plan_type: PlanType;
  plan_line_excel: PlanLineExcel;
  carrier_raw: string;
  pricing: BongsimProductDetailPricingV1;
};

export type BongsimProductDetailSpecsV1 = {
  network_raw: string;
  internet_raw: string;
  data_class_raw: string;
  qos_raw: string;
  validity_raw: string;
  apn_raw: string;
  mcc_raw: string;
  mnc_raw: string;
};

export type BongsimProductDetailUsageV1 = {
  activation_policy_raw: string;
  install_benchmark_raw: string;
  hotspot_flag_raw: string;
  kyc_flag_raw: string;
};

export type BongsimProductDetailPoliciesV1 = {
  esim_constraint_raw: string;
  usim_constraint_raw: string;
  request_shipment_flag_raw: string;
  status_check_flag_raw: string;
  extension_iccid_topup_flag_raw: string;
  data_integrity: {
    classification_conflict: boolean;
    buyer_safe_note: string | null;
  };
};

export type BongsimProductDetailStickyV1 = {
  summary: BongsimProductDetailSummaryV1;
  cta: {
    primary: "purchase_intent";
    payload: { option_api_id: string };
  };
};

/**
 * Public detail-page contract (`bongsim.product_detail.v1`).
 * Internal-only fields (vendor_code, raw_row, etc.) are intentionally omitted.
 */
export type BongsimProductDetailV1 = {
  schema: "bongsim.product_detail.v1";
  ids: { option_api_id: string };
  summary: BongsimProductDetailSummaryV1;
  specs: BongsimProductDetailSpecsV1;
  usage: BongsimProductDetailUsageV1;
  policies: BongsimProductDetailPoliciesV1;
  sticky: BongsimProductDetailStickyV1;
};
