# simplyur Mobile (React Native / Expo)

Cross-platform iOS + Android app for **Korea eSIM** (Phase 1).  
Backend: BONGTOUR `GET /api/simplyur/*` (same repo, run separately).

## Stack

| Layer | Choice |
|-------|--------|
| Mobile | **React Native + Expo SDK 57** (Expo Router tabs) |
| API | BONGTOUR Next.js (`/api/simplyur/products/by-country`) |
| i18n | en, ja, zh, zh-TW, vi (JSON synced from `lib/simplyur/messages/`) |

Why React Native over Flutter: BONGTOUR is TypeScript/Next.js — shared types, API contracts, and team skills align.

## Run locally

**Terminal 1 — API**

```bash
cd C:\Users\USER\Desktop\BONGTOUR
npm run dev
```

**Terminal 2 — App**

```bash
cd apps/simplyur-mobile
copy .env.example .env
# Edit EXPO_PUBLIC_API_BASE_URL (see below)
npm start
```

Press `a` (Android) or scan QR with Expo Go (iOS).

### API URL by device

| Environment | `EXPO_PUBLIC_API_BASE_URL` |
|-------------|----------------------------|
| iOS Simulator | `http://localhost:3000` |
| Android Emulator | `http://10.0.2.2:3000` |
| Physical phone | `http://<your-PC-LAN-IP>:3000` |

## Screens

- **Home** — Korea eSIM hero, CTA
- **Plans** — live catalog from API (simplyur pricing + locale currency)
- **Guide** — eSIM install steps
- **Language** — modal picker

## App Store IDs (placeholder)

- iOS: `com.bongtour.simplyur`
- Android: `com.bongtour.simplyur`

## Next steps

1. Stripe in-app checkout (WebView or native SDK)
2. Push notifications (order / QR ready)
3. Japan eSIM (Phase 1b)
4. Tourism & tickets (Phase 3)

## Sync translations

After editing web messages:

```powershell
Copy-Item ..\..\lib\simplyur\messages\*.json src\i18n\messages\
```

(from `apps/simplyur-mobile`)
