/** 봉심 storefront + persistence enumerations (fixed design). */

export type NetworkFamily = "local" | "roaming";

export type PlanTypeRoaming = "unlimited" | "fixed" | "daily";

/** `null` only for 로컬 product line (storefront local bucket). */
export type PlanType = PlanTypeRoaming | null;

export type PlanLineExcel = "로컬" | "무제한" | "종량제" | "데일리";

export type ExcelSheetLanguage = "ko" | "en";

export type OrderStatus =
  | "draft"
  | "awaiting_payment"
  | "paid"
  | "fulfillment_queued"
  | "fulfillment_in_progress"
  | "fulfilled"
  | "fulfillment_failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export type PaymentStatus =
  | "unpaid"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type PaymentAttemptStatus =
  | "created"
  | "redirected"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled"
  | "expired";

export type FulfillmentJobStatus =
  | "queued"
  | "in_progress"
  | "submitted"
  | "acknowledged"
  | "profile_issued"
  | "delivered"
  | "failed"
  | "cancelled";
