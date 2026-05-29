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

/** QR 이미지 URL + SM-DP+ / 활성화 코드 (수동 설치) */
export type BongsimOrderPublicEsimInstallV1 = {
  ready: boolean;
  qr_image_url: string | null;
  sm_dp_plus_address: string | null;
  activation_code: string | null;
  apple_quick_install_url: string | null;
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
  esim_install: BongsimOrderPublicEsimInstallV1;
  /** 고객 전액 취소(웰컴페이 환불) 가능 여부 */
  cancel_eligible: boolean;
  cancel_block_reason: string | null;
};
