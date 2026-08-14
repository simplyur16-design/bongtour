# Simplyur × Eximbay — 결제창 연동 준비 계약

**Scope:** Simplyur 외국인 eSIM 전용 Eximbay [결제창 연동 준비](https://developer.eximbay.com/eximbay/payment_linkage/preparing-payment.html) + [FGKey](https://developer.eximbay.com/eximbay/payment_linkage/preparing-fgkey.html).

**Out of scope (do not touch):**

- 봉투어 웰컴페이먼츠 (`lib/bongsim/welcomepay*`, `/travel/esim/.../welcomepay`, `WELCOMEPAY_*`)
- Simplyur PortOne 실결제 기본 경로 (PayPal / KICC) — 이번 단계는 병행 준비만

REGRESSION-FREEZE: `simplyur-eximbay-payment-prep`

## Env (server)

| Var | Role |
|-----|------|
| `EXIMBAY_MID` | Merchant mid |
| `EXIMBAY_API_KEY` | API key — **never** `NEXT_PUBLIC_*` |
| `EXIMBAY_ENV` | `test` → `https://api-test.eximbay.com` / `production` → `https://api.eximbay.com` |
| `SIMPLYUR_EXIMBAY_PREP_UI` | Optional smoke UI on checkout |
| `SIMPLYUR_EXIMBAY_MULTI_PAYMETHOD` | Optional. Default `P000-P002`. Add `-P001-P003` later for PayPal + Alipay. |

Auth header: `Authorization: Basic base64(apiKey + ":")`.

Test sample (docs only, not for production secrets): mid `1849705C64`, key `test_1849705C642C217E0B2D`.

**Production guard:** when `EXIMBAY_ENV=production`, public test MID/key and any `test_` API key are rejected (`eximbay_env_incomplete`). Live MID + `live_` key required on Railway.

## Endpoints

| Path | Role |
|------|------|
| `POST /api/simplyur/checkout/eximbay-ready` | Server `POST /v1/payments/ready` → `fgkey` + identical `request_pay` payload |
| `POST|GET /api/simplyur/webhooks/eximbay` | `status_url` — querystring → `POST /v1/payments/verify`; ACK `rescode=0000&resmsg=Success` |
| `/simplyur/{locale}/checkout/eximbay-return` | `return_url` browser stub (does not mark paid) |

Currency: **USD** (KRW order total → USD via existing Simplyur FX helpers).

## Client

- SDK: `{apiOrigin}/v2/javascriptSDK.js` → `EXIMBAY.request_pay({ fgkey, payment, merchant, buyer, url })`
- Params for `request_pay` **must match** ready body (else FGKey fails)
- Hosted methods: default `other.multi_paymethod` = `P000-P002` (credit card + UnionPay). **Not** Eximbay Pay app. PayPal `P001` / Alipay Plus `P003` stay off until `SIMPLYUR_EXIMBAY_MULTI_PAYMETHOD` is set (e.g. `P000-P002-P001-P003`).
- EXIMPay+ app install is **optional**. Checkout does not require it. People who want the app get a store link (Play / App Store); payment continues with card in simplyur.
- Smoke panel only when prep UI flag is on; live checkout remains PortOne

## Next phase (not this contract)

- Replace PortOne as default Simplyur PG
- Mark order paid + USIMSA fulfillment from verified status
- Cancel / inquiry APIs
- Live `live_` keys in production
