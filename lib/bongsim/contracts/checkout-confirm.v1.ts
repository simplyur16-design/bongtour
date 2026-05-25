import type { BongsimOrderV1 } from "@/lib/bongsim/contracts/order.v1";

export type BongsimCheckoutConfirmLineV1 = {
  option_api_id: string;
  quantity: number;
};

export type BongsimCheckoutConfirmRequestV1 = {
  schema: "bongsim.checkout_confirm.request.v1";
  /**
   * 하위호환 단일 SKU. `lines`가 없을 때만 사용.
   * 서버 정규화: `lines`가 있으면 `lines`만 사용(단일 필드 무시). 없으면 `[{ option_api_id, quantity }]`로 변환.
   */
  option_api_id?: string;
  quantity?: number;
  /** 다상품 라인. 있으면 이 배열만 사용. */
  lines?: BongsimCheckoutConfirmLineV1[];
  buyer_email: string;
  /** 알림톡·PG 모바일 결제용 (010…) */
  buyer_phone: string;
  buyer_locale?: "ko" | "en" | null;
  idempotency_key: string;
  checkout_channel?: string;
  consents?: {
    terms_version?: string;
    terms_accepted?: boolean;
    marketing?: { accepted?: boolean; version?: string | null };
    /** 선물하기 — QR·알림톡은 받는 분 연락처로 발송 */
    gift?: {
      is_gift: boolean;
      recipient_email?: string;
      recipient_phone?: string;
      recipient_name?: string | null;
    };
  };
  /** `/api/bongsim/coupon/validate` 응답의 `coupon_id` + 할인액(원). 둘 다 있을 때만 적용. */
  coupon_id?: string | null;
  coupon_discount_krw?: number | null;
  /** 로그인 사용자 보유 쿠폰 — `coupon_id` 와 동시 전송 불가. 할인액은 `coupon_discount_krw` 재사용. */
  user_coupon_id?: string | null;
  /** 세션 사용자 id(cuid) — 보유 쿠폰 검증·주문 consents 연결용 */
  bongtour_user_id?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrer?: string | null;
  landingPath?: string | null;
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
