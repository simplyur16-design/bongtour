/**
 * 봉심 환경 변수 계약 (Phase 9 — 교체 지점용).
 * 실제 값 검증은 각 라우트/어댑터에서 수행. 여기서는 이름·역할만 고정합니다.
 *
 * --- Payment (PG) replacement ---
 * - `BONGSIM_PAYMENT_PROVIDER_DEFAULT` (optional, future): 기본 결제 프로바이더 id.
 * - 실제 PG 키/merchant id 등은 `lib/bongsim/payments/payment-provider-registry.ts`에 구현 시 추가.
 *
 * --- Payment webhook replacement ---
 * - `BONGSIM_MOCK_WEBHOOK_SECRET`: mock 프로바이더 웹훅 검증(헤더 `x-bongsim-mock-webhook-secret`).
 *   production에서는 반드시 설정(미설정 시 mock 웹훅 라우트 503).
 * - 실 PG는 `lib/bongsim/payments/webhook/webhook-verifier-registry.ts`에 서명 검증 구현 시 추가.
 *
 * --- Supplier replacement ---
 * - `BONGSIM_SUPPLIER_CLIENT_ID` (optional): 기본값 `bongsim_mock_supplier`.
 *   실제 공급 API는 `lib/bongsim/supplier/supplier-client-registry.ts`에서 분기 추가.
 *
 * --- Core / ops ---
 * - `DATABASE_URL`: Postgres (필수).
 * - `BONGSIM_INTERNAL_IMPORT_SECRET`: Excel import 내부 API (미설정 시 해당 라우트 503).
 * - `BONGSIM_INTERNAL_FULFILLMENT_SECRET`: fulfillment runner 내부 API (미설정 시 503).
 * - `BONGSIM_ORDER_READ_KEY` (optional): 주문 공개 조회 시 쿼리 `read_key` 강제.
 * - `BONGSIM_ALLOW_MOCK_CAPTURE=1`: production에서만 mock 결제 스택 허용(기본 차단).
 *
 * --- Toss Payments ---
 * - `TOSS_SECRET_KEY`: 서버 전용 시크릿 (승인·조회·웹훅 double-check).
 * - `NEXT_PUBLIC_TOSS_CLIENT_KEY`: 브라우저 SDK 초기화용 클라이언트 키.
 *
 * --- Welcome Payments (PayWelcome, 봉심 eSIM) ---
 * - `WELCOMEPAY_MID`: 가맹점 ID.
 * - `WELCOMEPAY_SIGN_KEY`: 서버 전용 서명 키(노출 금지).
 * - `WELCOMEPAY_ENV`: `test` | `production` (엔드포인트·스크립트 URL 분기).
 */
export const BONGSIM_ENV_KEYS = {
  DATABASE_URL: "DATABASE_URL",
  BONGSIM_INTERNAL_IMPORT_SECRET: "BONGSIM_INTERNAL_IMPORT_SECRET",
  BONGSIM_INTERNAL_FULFILLMENT_SECRET: "BONGSIM_INTERNAL_FULFILLMENT_SECRET",
  BONGSIM_MOCK_WEBHOOK_SECRET: "BONGSIM_MOCK_WEBHOOK_SECRET",
  BONGSIM_ALLOW_MOCK_CAPTURE: "BONGSIM_ALLOW_MOCK_CAPTURE",
  BONGSIM_ORDER_READ_KEY: "BONGSIM_ORDER_READ_KEY",
  BONGSIM_SUPPLIER_CLIENT_ID: "BONGSIM_SUPPLIER_CLIENT_ID",
  BONGSIM_PAYMENT_PROVIDER_DEFAULT: "BONGSIM_PAYMENT_PROVIDER_DEFAULT",
  NODE_ENV: "NODE_ENV",
} as const;

export type BongsimEnvKeyName = (typeof BONGSIM_ENV_KEYS)[keyof typeof BONGSIM_ENV_KEYS];
