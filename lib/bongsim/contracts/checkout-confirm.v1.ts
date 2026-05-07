import type { BongsimOrderV1 } from "@/lib/bongsim/contracts/order.v1";

export type BongsimCheckoutConfirmRequestV1 = {
  schema: "bongsim.checkout_confirm.request.v1";
  option_api_id: string;
  quantity: number;
  buyer_email: string;
  buyer_locale?: "ko" | "en" | null;
  idempotency_key: string;
  checkout_channel?: string;
  consents?: {
    terms_version?: string;
    terms_accepted?: boolean;
    marketing?: { accepted?: boolean; version?: string | null };
  };
  /** `/api/bongsim/coupon/validate` 응답의 `coupon_id` + 할인액(원). 둘 다 있을 때만 적용. */
  coupon_id?: string | null;
  coupon_discount_krw?: number | null;
};

/** `order.order_number` — 고객·CS용 BS- 접두 주문번호(표시). `order.order_id`는 내부 UUID. */
export type BongsimCheckoutConfirmResponseV1 = {
  schema: "bongsim.checkout_confirm.response.v1";
  order: BongsimOrderV1["order"];
};

export type BongsimCheckoutConfirmErrorBodyV1 = {
  schema: "bongsim.checkout_confirm.error.v1";
  error: string;
  details?: Record<string, string>;
};
