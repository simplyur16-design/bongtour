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
| **2** | ~~PortOne checkout (PayPal + KICC)~~ — retired 2026-07-31, code removed 2026-10-30. Replaced by 2b (Eximbay) |
| **2b** | Eximbay payment-window **live** (FGKey / ready / status_url → OrderPaid). Mobile UI (`ostype=M`, redirect). Simplyur checkout PG is Eximbay only. Bongtour Welcomepay untouched |
| **2c** | App store release + **ASO listing SSOT** (`apps/simplyur-mobile/store-listing/aso/`) — Buy → web Eximbay handoff ✅; EAS build checklist [`STORE_RELEASE.md`](../apps/simplyur-mobile/STORE_RELEASE.md) |
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

## PortOne (retired)

PortOne (PayPal / KICC) was dropped from checkout on 2026-07-31 (`2ff6c980`) and its code, `@portone/*` packages, `PORTONE_*` env and `/api/simplyur/webhooks/portone` were removed on 2026-10-30. Historical rows may still carry `provider = 'portone'` (DB unchanged).

### PG review URLs

- **PG resubmit URLs** — service `/simplyur/en`, products `/simplyur/en/recommend`, legal `/simplyur/en/legal/*`.

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
