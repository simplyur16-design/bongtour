/** Read model for order status / completion UI (no secrets). */
export type BongsimOrderPublicLineV1 = {
  option_api_id: string;
  quantity: number;
  plan_name: string;
  option_label: string;
  line_total_krw: number;
};

export type BongsimOrderPublicFulfillmentV1 = {
  job_id: string;
  status: string;
  supplier_submission_id: string | null;
  supplier_profile_ref: string | null;
  supplier_iccid: string | null;
  delivered_at: string | null;
  attempt_count: number;
};

export type BongsimOrderPublicV1 = {
  schema: "bongsim.order_public.v1";
  order_id: string;
  order_number: string;
  status: string;
  currency: "KRW";
  grand_total_krw: number;
  buyer_email_masked: string;
  paid_at: string | null;
  payment_reference: string | null;
  paid_amount_krw: number | null;
  payment_provider: string | null;
  lines: BongsimOrderPublicLineV1[];
  fulfillment: BongsimOrderPublicFulfillmentV1 | null;
  install_stub: { kind: "placeholder"; label: string; href: string | null };
};
