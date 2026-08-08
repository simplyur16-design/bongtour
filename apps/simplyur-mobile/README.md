# simplyur Mobile (React Native / Expo)

**Foreign visitors to Korea only** — dedicated Korea eSIM app (Phase 1).  
Not for Korea residents; domestic users use **Bong Tour eSIM (bongsim)** at `/travel/esim`.

Backend: BONGTOUR `GET /api/simplyur/*` · checkout pays via **web Eximbay** (mobile UI).

## Audience SSOT

| Product | Who | Login |
|---------|-----|-------|
| **simplyur app** | International visitors to Korea | Google · Apple · email (in app) |
| **simplyur web** | Same audience (supplementary) | Email / social as configured |
| **bongsim / Bong Tour** | Korea residents | Kakao · Naver · email |

## Stack

| Layer | Choice |
|-------|--------|
| Mobile | **React Native + Expo SDK 57** (Expo Router tabs) |
| API | BONGTOUR Next.js (`/api/simplyur/…`) |
| Pay (now) | Buy → in-app browser → `/simplyur/{locale}/checkout` → Eximbay mobile window |
| Pay (later) | Native in-app payment (Phase 2c) |
| i18n | en, ja, zh, zh-TW, vi |

## Run locally

**Terminal 1 — API**

```bash
npm run dev
```

**Terminal 2 — App**

```bash
cd apps/simplyur-mobile
cp .env.example .env
# Local API: set EXPO_PUBLIC_API_BASE_URL (see table)
npm start
```

Press `a` (Android) or scan QR with Expo Go (iOS).

### API URL by device

| Environment | `EXPO_PUBLIC_API_BASE_URL` |
|-------------|----------------------------|
| Release / EAS production | `https://bongtour.com` (default when not `__DEV__`) |
| iOS Simulator | `http://localhost:3000` |
| Android Emulator | `http://10.0.2.2:3000` |
| Physical phone | `http://<your-PC-LAN-IP>:3000` |

## Checkout

- `EXPO_PUBLIC_SIMPLYUR_CHECKOUT_ENABLED=1` (default) — **Buy now** opens the web checkout URL.
- Payment UI is Eximbay **mobile** (`ostype=M`), not PC popup.
- My eSIM may open the **web** My eSIM page when the app has no shared session cookie.

## Store release (EAS)

Full checklist: [`STORE_RELEASE.md`](./STORE_RELEASE.md)

```bash
cd apps/simplyur-mobile
npx eas login
npx eas init          # writes real projectId into app.json extra.eas
npx eas build --platform all --profile preview      # internal APK / iOS
npx eas build --platform all --profile production
npx eas submit --platform ios --profile production
npx eas submit --platform android --profile production
```

Store listing URLs (also in `app.json` → `extra`):

- Privacy: https://bongtour.com/simplyur/en/legal/privacy  
- Terms: https://bongtour.com/simplyur/en/legal/terms  
- Support: https://bongtour.com/simplyur/en  

Apple: enable **Sign in with Apple** capability (bundle `com.bongtour.simplyur`) before submit if the Apple button ships.

## Screens

- **Home** — Korea eSIM hero, CTA  
- **Plans** — live catalog from API  
- **Guide** — eSIM install steps  
- **My eSIM** — orders (web fallback when unsigned in app)  
- **Language** — modal picker  

## App IDs

- iOS / Android: `com.bongtour.simplyur`  
- Deep link: `simplyur://` (OAuth return `simplyur://oauth-complete`)

## Sync translations

After editing web messages:

```bash
cp ../../lib/simplyur/messages/*.json src/i18n/messages/
```

(from `apps/simplyur-mobile`) — then re-apply app-only keys (`payInBrowserHint`, `continueInBrowser`) if overwritten.
