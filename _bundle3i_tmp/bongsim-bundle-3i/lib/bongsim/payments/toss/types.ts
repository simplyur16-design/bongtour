/**
 * Toss Payments API response schemas (minimal subset we actually use).
 * Full schema: https://docs.tosspayments.com/reference
 */

export type TossPaymentStatus =
  | "READY"
  | "IN_PROGRESS"
  | "WAITING_FOR_DEPOSIT"
  | "DONE"
  | "CANCELED"
  | "PARTIAL_CANCELED"
  | "ABORTED"
  | "EXPIRED";

export type TossPaymentMethod =
  | "카드"
  | "가상계좌"
  | "간편결제"
  | "휴대폰"
  | "계좌이체"
  | "문화상품권"
  | "도서문화상품권"
  | "게임문화상품권";

export type TossCancelEntry = {
  transactionKey: string;
  cancelReason: string;
  canceledAt: string;
  cancelAmount: number;
  cancelStatus: "DONE" | string;
  /** 취소 후 환불 가능 잔액. */
  refundableAmount?: number;
};

export type TossPaymentObject = {
  version: string;
  paymentKey: string;
  type: "NORMAL" | "BILLING" | "BRANDPAY";
  orderId: string;
  orderName: string;
  mId: string;
  currency: string;
  method: TossPaymentMethod | string | null;
  totalAmount: number;
  balanceAmount: number;
  status: TossPaymentStatus;
  requestedAt: string;
  approvedAt: string | null;
  /** 카드사 승인번호 등 저장해두면 운영에 유용. */
  card?: {
    issuerCode?: string;
    acquirerCode?: string;
    number?: string;
    installmentPlanMonths?: number;
    approveNo?: string;
    cardType?: string;
    ownerType?: string;
  } | null;
  virtualAccount?: {
    accountNumber?: string;
    bankCode?: string;
    dueDate?: string;
    expired?: boolean;
  } | null;
  cashReceipt?: {
    type?: string;
    amount?: number;
    issueNumber?: string;
  } | null;
  easyPay?: {
    provider?: string;
    amount?: number;
    discountAmount?: number;
  } | null;
  cancels?: TossCancelEntry[] | null;
  receipt?: { url?: string } | null;
  /** 웹훅/조회 공통: failure 발생 시 정보. */
  failure?: { code?: string; message?: string } | null;
};

/** 에러 응답. 비즈니스 로직 에러와 HTTP 에러 모두 이 형태. */
export type TossErrorResponse = {
  code: string;
  message: string;
};
