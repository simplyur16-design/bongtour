import type {
  BongsimPriceBlockV1,
  BongsimProductFlagsV1,
} from "@/lib/bongsim/contracts/product-master.v1";
import type {
  NetworkFamily,
  OrderStatus,
  PaymentStatus,
  PlanLineExcel,
  PlanType,
} from "@/lib/bongsim/contracts/public-enums";

/** Immutable purchase-time line snapshot for fulfillment + customer truth. */
export type BongsimOrderLineSnapshotV1 = {
  option_api_id: string;
  charged_basis_key: string;
  charged_unit_price_krw: number;
  vendor_code: string;
  sim_kind: string;
  plan_name: string;
  option_label: string;
  days_raw: string;
  allowance_label: string;
  network_family: NetworkFamily;
  plan_type: PlanType;
  plan_line_excel: PlanLineExcel;
  price_block: BongsimPriceBlockV1;
  carrier_raw: string;
  network_raw: string;
  internet_raw: string;
  data_class_raw: string;
  qos_raw: string;
  validity_raw: string;
  apn_raw: string;
  install_benchmark_raw: string;
  activation_policy_raw: string;
  mcc_raw: string;
  mnc_raw: string;
  flags: BongsimProductFlagsV1;
  classification_conflict: boolean;
  classification_notes: string | null;
};

export type BongsimOrderLineV1 = {
  line_id: string;
  option_api_id: string;
  quantity: number;
  charged_unit_price_krw: number;
  line_total_krw: number;
  charged_basis_key: string;
  snapshot: BongsimOrderLineSnapshotV1;
};

export type BongsimOrderTotalsV1 = {
  currency: "KRW";
  subtotal_krw: number;
  discount_krw: number;
  tax_krw: number;
  grand_total_krw: number;
};

export type BongsimOrderBuyerV1 = {
  email: string;
  locale: "ko" | "en" | null;
};

export type BongsimOrderConsentsV1 = {
  terms_version: string;
  terms_accepted: true;
  marketing: { accepted: boolean; version: string | null };
  /** 주문 생성 시 적용된 쿠폰(결제 캡처 후 `bongsim_coupon_usage` 기록용). */
  coupon_id?: string | null;
  coupon_discount_krw?: number;
};

export type BongsimOrderPaymentV1 = {
  payment_status: PaymentStatus;
  payment_provider: string | null;
  payment_reference: string | null;
  paid_amount_krw: number;
  paid_currency: "KRW";
  paid_at: string | null;
  failure: { code: string | null; message: string | null };
};

export type BongsimOrderFulfillmentV1 = {
  fulfillment_status:
    | "not_started"
    | "submitted"
    | "acknowledged"
    | "profile_issued"
    | "delivered"
    | "failed";
  supplier_submission_id: string | null;
  supplier_ids: { profile: string | null; iccid: string | null; other: Record<string, unknown> };
  attempt_count: number;
  last_error: { code: string | null; at: string | null };
  delivered_at: string | null;
  audit: { payload_out_ref: string | null; payload_in_last_ref: string | null };
};

export type BongsimOrderV1 = {
  schema: "bongsim.order.v1";
  order: {
    order_id: string;
    order_number: string;
    status: OrderStatus;
    created_at: string;
    updated_at: string;
    checkout_channel: string;
    buyer: BongsimOrderBuyerV1;
    consents: BongsimOrderConsentsV1;
    idempotency_key: string;
    totals: BongsimOrderTotalsV1;
    payment: BongsimOrderPaymentV1;
    fulfillment: BongsimOrderFulfillmentV1;
    lines: BongsimOrderLineV1[];
  };
};
