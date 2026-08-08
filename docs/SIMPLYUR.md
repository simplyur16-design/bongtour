# simplyur — Global sub-brand (Bong Tour Co., Ltd.)

**simplyur** is a sub-brand of 봉투어 for foreign travelers.

## Phase 1 (current): Korea eSIM only

- Web: `/simplyur/{locale}` (en, ja, zh, zh-TW, vi)
- Mobile: `apps/simplyur-mobile` — **React Native (Expo)**, iOS + Android
- Countries: **`kr` only** (Japan in Phase 1b)
- Pricing: `after.consumer_krw × 1.05` → locale currency (ExchangeRate-API, ~12h cache; env fallback)

## Architecture

```
BONGTOUR (Next.js)                    apps/simplyur-mobile (Expo)
├── lib/simplyur/                       ├── src/api → fetch BONGTOUR API
├── app/simplyur/[locale]/              ├── Home / Plans / Guide tabs
├── app/api/simplyur/                   └── 5 languages
└── bongsim + USIMSA (shared)
```

## Why React Native (not Flutter / Capacitor)

- One codebase → iOS + Android (App Store + Play Store)
- TypeScript aligned with BONGTOUR backend
- Faster iteration for a startup sub-brand

## Design — Korean palette

| Token | Color | Meaning |
|-------|-------|---------|
| **dan** | `#C53E3A` | 단(丹) 적색 — CTA, price |
| **celadon** | `#3D6B5E` | 청자(青瓷) — brand, nav |
| **hanji** | `#FAF7F2` | 한지 — background |
| **ink** | `#1F1B2D` | 먹 — text |

SSOT: `lib/simplyur/colors.ts` (web), `apps/simplyur-mobile/src/constants/palette.ts` (mobile)

## Routes (web)

| URL | Description |
|-----|-------------|
| `/simplyur/en` | Korea eSIM landing |
| `/simplyur/en/recommend` | Korea plan list |
| `/simplyur/en/product/{optionApiId}` | Plan detail + buy |
| `/simplyur/en/checkout` | Guest checkout (email) |

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/simplyur/countries?locale=en` | KR only |
| `GET /api/simplyur/products/by-country?codes=kr&locale=en` | Plans + simplyur pricing |
| `GET /api/simplyur/products/{optionApiId}?locale=en` | Single Korea plan |
| `POST /api/simplyur/checkout/confirm` | Create order (`checkout_channel=simplyur_web`, price ×1.05) |

## Roadmap

| Phase | Scope |
|-------|--------|
| **1** ✅ | Korea-only eSIM, plan cards, web + Expo, i18n, pricing |
| **1b** | Japan eSIM |
| **2** | PortOne checkout (`portone` provider): **PayPal** + **KICC overseas** (WeChat / Alipay Plus), USD charge, USIMSA fulfillment via OrderPaid outbox |
| **2b** | Eximbay payment-window **live** (FGKey / ready / status_url → OrderPaid). Mobile UI (`ostype=M`, redirect). PortOne is not used for Simplyur checkout. Bongtour Welcomepay untouched |
| **2c** | App store release: Buy → web Eximbay handoff (mobile UI) ✅ scaffolding; then **native in-app payment**; EAS `eas init` + store submit — checklist [`apps/simplyur-mobile/STORE_RELEASE.md`](../apps/simplyur-mobile/STORE_RELEASE.md) (API host `bongtour.com`, bundle `com.bongtour.simplyur`) |
| **3** | Capacitor optional; store release polish |
| **4** | Korea tourism, tickets, experiences |

## Eximbay live checkout (Simplyur only)

Contract: [`docs/ops/simplyur-eximbay-payment-prep-contract.md`](ops/simplyur-eximbay-payment-prep-contract.md) · [Eximbay preparing-payment](https://developer.eximbay.com/eximbay/payment_linkage/preparing-payment.html)

- Env: `EXIMBAY_MID`, `EXIMBAY_API_KEY` (server), `EXIMBAY_ENV=test|production`, `SIMPLYUR_CHECKOUT_ENABLED=1`
- Live path: confirm → `provider=eximbay` session → `EXIMBAY.request_pay` → status_url marks paid
- Client form: phone → `settings.ostype=M` + `display_type=R` (mobile window); wide desktop → `P`/`P`
- Status: `/api/simplyur/webhooks/eximbay` · Return: `/simplyur/{locale}/checkout/eximbay-return` → complete
- Optional smoke UI: `SIMPLYUR_EXIMBAY_PREP_UI=1`
- **Later:** native app checkout (Expo) — not PC popup; web handoff or in-app Eximbay WebView first

## PortOne setup (simplyur overseas PG)

Docs: [PortOne V2 PG overview](https://developers.portone.io/opi/ko/integration/pg/v2/readme?v=v2) · [PayPal](https://developers.portone.io/opi/ko/integration/pg/v2/paypal-v2) · [KICC overseas](https://developers.portone.io/opi/ko/integration/pg/v2/kicc-v2) · **[PayPal channel console SSOT](https://help.portone.io/content/paypal)**

### PayPal (SPB) — test channel (required for simplyur)

Operator checklist from [help.portone.io/content/paypal](https://help.portone.io/content/paypal):

1. **PortOne console** → 결제 연동 → 채널관리 → **+ 채널 추가**
2. Set exactly:
   - **연동 모드**: 테스트 연동
   - **결제대행사**: 페이팔
   - **결제모듈**: **결제창 일반결제(SPB)/정기결제(RT)** — not Express Checkout
3. **PG상점아이디 (PayPal Merchant ID)** — use PortOne **shared test seller ID** (not PayPal Developer Client ID / NVP-SOAP):

   | Country | Merchant ID |
   |---------|---------------|
   | UK (recommended) | `PA4DULN9V66L6` |
   | US | `7WBB3CKT63FRG` |
   | KR | `UFYSG9T7RFW2A` |
   | JP | `PX5CTVZJTRXG4` |
   | (others) | see help.portone.io table |

4. **Save**, then copy this channel’s **channel key** → `PORTONE_CHANNEL_KEY_PAYPAL` in `.env.local`.
5. **Buyer for test**: PayPal Sandbox **Personal**, **Country = US** (KR seller + KR buyer is blocked by PayPal policy).

**Do not put in PortOne SPB channel:** PayPal REST Client ID/Secret, NVP/SOAP Username/Password/Signature — those are **Express Checkout (V1 only)**. simplyur uses `loadPaymentUI` + `PAYPAL_SPB` (V2). Wrong channel type → `PG_PROVIDER_PAYPAL credential 조회 미지원`.

Verify: `npx tsx scripts/inspect-portone-channels-safe.ts` · `npx tsx scripts/verify-simplyur-portone-payment-window.ts --base-url=http://localhost:3000`

### KICC (WeChat / Alipay Plus) — test channel

SSOT: [help.portone.io/content/kicc](https://help.portone.io/content/kicc) · code: [KICC v2](https://developers.portone.io/opi/ko/integration/pg/v2/kicc-v2)

Operator checklist (**결제창 일반/정기결제 V1** — PortOne shared test MID, **no separate key**):

1. **PortOne console** → 결제 연동 → 채널관리 → **+ 채널 추가**
2. Set exactly:
   - **연동 모드**: 테스트 연동
   - **결제대행사**: 이지페이(KICC)
   - **결제모듈**: **일반결제 V1** (콘솔 표기; help = 구모듈 결제창 일반/정기결제)
3. **PG상점아이디 (MID)** — 클릭 후 선택 (직접 입력·암복호화 키 없음):
   - **이지페이_KICC 결제창 일반결제 및 정기결제 (`T5102001`)**
4. **Save**, copy **channel key** → `PORTONE_CHANNEL_KEY_KICC` in `.env.local` (and Railway).
5. **Webhook** (required for QR async paid): `https://bongtour.com/api/simplyur/webhooks/portone` (Payment module V2).
6. **Mobile WeChat**: register checkout domain `bongtour.com` with KICC.

simplyur calls `requestPayment` with `EASY_PAY`/`WECHAT` and `ALIPAY_PLUS`.

Verify: `npx tsx scripts/verify-simplyur-portone-payment-window.ts --base-url=http://localhost:3000` — KICC should open a payment window.

### Env + webhook

1. **Env** (see `.env.example`) — `PORTONE_STORE_ID`, `PORTONE_API_SECRET`, `PORTONE_CHANNEL_KEY_PAYPAL`, `PORTONE_CHANNEL_KEY_KICC`, enable `SIMPLYUR_CHECKOUT_ENABLED`.
2. **Webhook** — register `https://bongtour.com/api/simplyur/webhooks/portone` (Payment module V2, `Transaction.Paid`). Required for KICC QR async approval and recommended for PayPal.
3. **KICC domain** — register `bongtour.com` (checkout path) with KICC for mobile WeChat Pay.
4. **PG resubmit URLs** — service `/simplyur/en`, products `/simplyur/en/recommend`, legal `/simplyur/en/legal/*`.

Checkout charges in **USD** (minor units) derived from order KRW total via the same FX snapshot as catalog display (`resolveSimplyurFxRates` / `SIMPLYUR_FX_*` fallback).
| **3** | Capacitor optional; store release polish |
| **4** | Korea tourism, tickets, experiences |

## Local dev

```bash
# Web
npm run dev
# http://localhost:3000/simplyur/en

# Mobile — see apps/simplyur-mobile/README.md
```
