# simplyur Mobile (React Native / Expo)

**Foreign visitors to Korea only** — dedicated Korea eSIM app (Phase 1).  
Not for Korea residents; domestic users use **Bong Tour eSIM (bongsim)** at `/travel/esim`.

Backend: BONGTOUR `GET/POST /api/simplyur/*` · in-app Eximbay checkout (WebView) · My eSIM Bearer session.

## Audience SSOT

| Product | Who | Login |
|---------|-----|-------|
| **simplyur app** | International visitors to Korea | Google · Apple · email (in app) |
| **simplyur web** | Same audience (supplementary) | Email (web); social as configured |
| **bongsim / Bong Tour** | Korea residents | Kakao · Naver · email |

## Stack

| Layer | Choice |
|-------|--------|
| Mobile | **React Native + Expo SDK 57** (Expo Router) |
| API | BONGTOUR Next.js (`/api/simplyur/…`) |
| Pay | Native `/checkout` → Eximbay PAYER_AUTH WebView → `complete-pa` |
| Session | SecureStore Bearer (`simplyur_access_token`) |
| i18n | en, ja, zh, zh-TW, vi (persisted) |

## Run locally

**Terminal 1 — API**

```bash
npm run dev
```

**Terminal 2 — App**

```bash
cd apps/simplyur-mobile
cp .env.example .env
npm start
```

### API URL by device

| Environment | `EXPO_PUBLIC_API_BASE_URL` |
|-------------|----------------------------|
| Release / EAS production | `https://bongtour.com` (default when not `__DEV__`) |
| iOS Simulator | `http://localhost:3000` |
| Android Emulator | `http://10.0.2.2:3000` |
| Physical phone | `http://<your-PC-LAN-IP>:3000` |

## Checkout & My eSIM

- `EXPO_PUBLIC_SIMPLYUR_CHECKOUT_ENABLED=1` (default) — **Buy** opens native `/checkout` (not system browser).
- Payment UI is Eximbay **mobile** (`ostype=M`).
- My eSIM uses the same in-app Bearer session (Apple / Google / email) — QR, SM-DP+, usage, unused refund.
- Settings: language, legal (terms/privacy/refund), mailto support, sign-out, account delete.

## Store release (EAS)

Full checklist: [`STORE_RELEASE.md`](./STORE_RELEASE.md)

```bash
cd apps/simplyur-mobile
npx eas login
npx eas build --platform all --profile preview
npx eas build --platform all --profile production
npx eas submit --platform ios --profile production
npx eas submit --platform android --profile production
```

## Screens

- **Home** — Korea eSIM hero, CTA, Settings  
- **Plans** — live catalog from API  
- **Guide** — eSIM install steps  
- **My eSIM** — orders, QR, manual codes, refund  
- **Checkout** — native form + Eximbay WebView  
- **Settings / Language / Legal** — account & policies  

## App IDs

- iOS / Android: `com.bongtour.simplyur`  
- Deep link: `simplyur://` (OAuth return `simplyur://oauth-complete`)

## Sync translations

After editing web messages:

```bash
cp ../../lib/simplyur/messages/*.json src/i18n/messages/
```

Prefer editing app messages under `src/i18n/messages/` when copy is app-only.
