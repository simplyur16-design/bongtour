// USIMSA Partner API v2 타입. 필드명은 스펙 그대로 camelCase.

export type UsimsaSubmitRequest = {
  orderId: string;
  products: Array<{ optionId: string; qty: number }>;
};

export type UsimsaSubmitResponseProduct = {
  topupId: string;
  optionId: string;
};

export type UsimsaSubmitResponse = {
  products: UsimsaSubmitResponseProduct[];
  code: string;
  message: string;
};

export type UsimsaOrderQueryProduct = {
  createdAt: string;
  topupId: string;
  optionId: string;
  iccid?: string;
  smdp?: string;
  activateCode?: string;
  downloadLink?: string;
  qrCodeImgUrl?: string;
  status: string;
  expiredDate?: string;
};

export type UsimsaOrderQueryResponse = {
  products: UsimsaOrderQueryProduct[];
  code: string;
  message: string;
};

export type UsimsaCancelResponse = {
  code: string;
  message: string;
};

export type UsimsaWebhookPayload = {
  topupId: string;
  optionId: string;
  iccid?: string;
  smdp?: string;
  activateCode?: string;
  downloadLink?: string;
  qrcodeImgUrl?: string;
  qrCodeImgUrl?: string;
  expiredDate?: string;
};

export const USIMSA_CODE = {
  SUCCESS: "0000",
  INVALID_TOPUP_ID: "1001",
  PACKAGE_NOT_ALLOCATED: "1002",
  ALREADY_CANCELED: "1003",
  UNSUPPORTED_FEATURE: "1004",
  SERVER_ERROR: "9999",
} as const;

/** POST /v2/cancel/{topupId} 비즈니스 코드 (운영 매뉴얼) */
export const USIMSA_CANCEL_CODE = {
  SUCCESS: "0000",
  ALREADY_CANCELED: "9002",
  REFUND_NOT_ALLOWED: "9003",
  CANCEL_NOT_ALLOWED_STATE: "9006",
} as const;

export function isUsimsaCancelSuccess(code: string): boolean {
  const c = code.trim();
  return c === USIMSA_CANCEL_CODE.SUCCESS || c === USIMSA_CANCEL_CODE.ALREADY_CANCELED;
}

export function isRetriableUsimsaCode(code: string): boolean {
  return code === USIMSA_CODE.SERVER_ERROR;
}

export function isUsimsaSuccess(code: string): boolean {
  return code === USIMSA_CODE.SUCCESS;
}
