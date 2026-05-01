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
};

export type BongsimCheckoutConfirmResponseV1 = {
  schema: "bongsim.checkout_confirm.response.v1";
  order: BongsimOrderV1["order"];
};

export type BongsimCheckoutConfirmErrorBodyV1 = {
  schema: "bongsim.checkout_confirm.error.v1";
  error: string;
  details?: Record<string, string>;
};
