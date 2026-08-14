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

## Verify loop (operator SSOT)

| Windows PC | This Mac |
|------------|----------|
| **Android emulator** | **iOS Simulator** (needs full Xcode) |

Local native run — not EAS OTA for day-to-day.  
Docs: `docs/ops/simplyur-mobile-local-devices.md`

**Windows tip:** if `npx expo run:android` fails with ninja path &gt; 260 chars, build from a short clone (`D:\bt`) — see ops doc.

```bash
cd apps/simplyur-mobile   # or D:\bt\apps\simplyur-mobile
cp .env.example .env
npx expo run:android      # Windows — emulator
```

### iOS Simulator (Mac only)

Windows **cannot** run the Apple Simulator. On this Mac:

1. Install **Xcode** from the Mac App Store (full app, not only Command Line Tools).
2. Open Xcode once → accept license → Settings → Locations → Command Line Tools = **Xcode**.
3. From repo root:

```bash
bash scripts/run-simplyur-ios-simulator.sh
# or:
cd apps/simplyur-mobile && npx expo run:ios
```

Until Xcode is installed, preview UI in a browser:

```bash
cd apps/simplyur-mobile
npm start -- --web
# → http://localhost:8081  (Chrome DevTools → device toolbar → iPhone)
```

Physical iPhone: install **Expo Go**, same LAN, scan QR from `npm start`.

### API URL by device

| Environment | `EXPO_PUBLIC_API_BASE_URL` |
|-------------|----------------------------|
| Live API | `https://bongtong.com` |
| iOS Simulator | `http://localhost:3000` |
| Android Emulator | `http://10.0.2.2:3000` |
| Physical iPhone (local API) | `http://<your-PC-LAN-IP>:3000` |

## Checkout & My eSIM

- `EXPO_PUBLIC_SIMPLYUR_CHECKOUT_ENABLED=1` (default) — **Buy** opens native `/checkout` (not system browser).
- Payment UI is Eximbay **mobile** (`ostype=M`).
- My eSIM uses the same in-app Bearer session (Apple / Google / email) — QR, SM-DP+, usage, unused refund.
- Settings: language, legal (terms/privacy/refund), mailto support, sign-out, account delete.

## Store release (optional / later)

Not the current verify loop. Checklist only when explicitly shipping to stores: [`STORE_RELEASE.md`](./STORE_RELEASE.md).

## Screens

- **Home** — Korea eSIM hero, CTA, Settings  
- **Plans** — live catalog from API  
- **Guide** — eSIM install steps  
- **My eSIM** — orders, QR, manual codes, refund  
- **Checkout** — native form + Eximbay WebView  
- **Settings / Language / Legal** — account & policies  

## App IDs

- iOS / Android: `com.bongtong.simplyur`  
- Deep link: `simplyur://` (OAuth return `simplyur://oauth-complete`)

## Sync translations

After editing web messages:

```bash
cp ../../lib/simplyur/messages/*.json src/i18n/messages/
```

Prefer editing app messages under `src/i18n/messages/` when copy is app-only.
