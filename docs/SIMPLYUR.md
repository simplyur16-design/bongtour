# simplyur — Global sub-brand (Bong Tour Co., Ltd.)

**simplyur** is a sub-brand of 봉투어 for foreign travelers.

## Phase 1 (current): Korea eSIM only

- Web: `/simplyur/{locale}` (en, ja, zh, zh-TW, vi)
- Mobile: `apps/simplyur-mobile` — **React Native (Expo)**, iOS + Android
- Countries: **`kr` only** (Japan in Phase 1b)
- Pricing: `after.consumer_krw × 1.10` → locale currency

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
| `POST /api/simplyur/checkout/confirm` | Create order (`checkout_channel=simplyur_web`, price ×1.10) |

## Roadmap

| Phase | Scope |
|-------|--------|
| **1** ✅ | Korea-only eSIM, plan cards, web + Expo, i18n, pricing |
| **1b** | Japan eSIM |
| **2** | PortOne checkout (`portone` provider), USIMSA fulfillment via OrderPaid outbox |
| **3** | Capacitor optional; store release polish |
| **4** | Korea tourism, tickets, experiences |

## Local dev

```bash
# Web
npm run dev
# http://localhost:3000/simplyur/en

# Mobile — see apps/simplyur-mobile/README.md
```
