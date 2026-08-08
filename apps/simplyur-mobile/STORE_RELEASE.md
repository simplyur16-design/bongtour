# simplyur — iOS / Android store release checklist

Production API host is **`https://bongtour.com`** (not `bongtong.com`).

Bundle / package: **`com.bongtour.simplyur`**

## A. One-time accounts (operator)

1. Expo account → https://expo.dev/signup  
2. Apple Developer Program → App Store Connect → New App  
   - Bundle ID: `com.bongtour.simplyur`  
   - Enable **Sign in with Apple** on that App ID  
3. Google Play Console → Create app  
   - Application ID: `com.bongtour.simplyur`  
4. Copy App Store Connect **Apple ID** (numeric) into `eas.json` → `submit.production.ios.ascAppId`

## B. Link EAS (once, on this machine)

```bash
cd apps/simplyur-mobile
npx eas login
npx eas init --account bongtour --force --non-interactive
```

Done for this repo: project **@bongtour/simplyur**  
https://expo.dev/accounts/bongtour/projects/simplyur  
(`projectId` `13ff775c-bb1f-4c06-bf1a-2fbf4ab014e5` in `app.json`)

Optional CI: set `EXPO_TOKEN` from https://expo.dev/settings/access-tokens

Do **not** add `eas-cli` to `package.json` (breaks `npm ci` on EAS). Use `npx eas-cli` / global install.

## C. Internal test builds (both platforms)

```bash
# Android APK (internal)
npx eas-cli build --platform android --profile preview

# iOS Simulator (.app / tarball) — no Apple Developer creds
npx eas-cli build --platform ios --profile preview_simulator

# iOS device (ad hoc) — requires Apple Developer login + registered devices
npx eas-cli build --platform ios --profile preview
```

### Done so far
- Android preview APK (2026-08-08): https://expo.dev/accounts/bongtour/projects/simplyur/builds/95b70ea8-011f-4082-9c97-14a149544e38  
  Artifact: https://expo.dev/artifacts/eas/8NZXjFXbG5gWl1sNnxbGCbJ3PgjnBl8ye0iJKssMyMA.apk
- Android production AAB (2026-08-08): https://expo.dev/accounts/bongtour/projects/simplyur/builds/7cd7e5f6-efb1-4ff6-b4d1-24d9458c7942  
  Artifact: https://expo.dev/artifacts/eas/4XxcatYp92feaRfm3PUaOrzieyEzIgSgLHO_SkzfaYQ.aab
- iOS Simulator (2026-08-08): https://expo.dev/accounts/bongtour/projects/simplyur/builds/6cd93489-937c-403e-88d7-40c76b439d39  
  Artifact: https://expo.dev/artifacts/eas/2zrbXBx3yXilKiqovQYraYLfJg21KErOOaAbRJoYUMk.tar.gz
- iOS Ad Hoc preview (device, 2026-08-08): https://expo.dev/accounts/bongtour/projects/simplyur/builds/bfb8a088-acce-4d9f-848c-7700671deb20  
  Install on registered iPhone via that page / QR

### Operator: iOS device / App Store (must run in a real terminal)

Cursor/agent shells are non-TTY — Apple credential prompts will not work here. On your machine:

```bash
cd apps/simplyur-mobile
npx eas-cli build --platform ios --profile preview
```

Log in with the Apple Developer account that will own `com.bongtour.simplyur`, let EAS create the distribution cert + ad hoc profile, then register test devices when asked.

Smoke: Home → Plans → Product → Buy (Eximbay mobile web) → My eSIM / Guide.

## D. Production builds + submit

```bash
npx eas build --platform all --profile production
npx eas submit --platform ios --profile production
npx eas submit --platform android --profile production
```

Then finish listing copy, screenshots, privacy questionnaire in each console and submit for review.

## Env (already in eas.json profiles)

| Key | Value |
|-----|--------|
| `EXPO_PUBLIC_API_BASE_URL` | `https://bongtour.com` |
| `EXPO_PUBLIC_SIMPLYUR_CHECKOUT_ENABLED` | `1` |
