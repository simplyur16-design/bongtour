# SimplyUR mobile — local device verification (operator SSOT)

**Locked 2026-08-10.** Cursor mirror: `.cursor/rules/simplyur-mobile-local-devices.mdc`.

## Phased verify

| Phase | Platform | Device / host |
|-------|----------|----------------|
| **Now** | Android | Windows PC → **emulator** (`npx expo run:android`) |
| **Later** | iOS | After GitHub sync → **operator iPhone** (resume prior Windows→device / Mac flow) |

Finish Android build + install on this machine first. iOS is deferred to GitHub-linked follow-up.

## Android on Windows (path length)

Desktop path `C:\Users\...\BONGTOUR\apps\simplyur-mobile\...` often exceeds Windows/ninja **260** chars.

Windows ninja **260-char** paths break builds under `Desktop\BONGTOUR\...`.

**Working fix (verified 2026-08-10):** junction to a shorter path, then build:

```powershell
cmd /c mklink /J C:\Users\USER\sma C:\Users\USER\Desktop\BONGTOUR\apps\simplyur-mobile
cd C:\Users\USER\sma
$env:GRADLE_USER_HOME='D:\gradle-home'
$env:TEMP='D:\tmp-build'; $env:TMP='D:\tmp-build'
npx expo run:android
```

Alternate: short git clone (`D:\bt`) + `npm install` there.

## Emulator without NAT (optional)

Some AVDs cannot reach public DNS. Host proxy + Metro base URL works:

```powershell
# terminal A — from repo root
node scripts/tmp-simplyur-host-proxy.mjs
# terminal B — short path
cd C:\Users\USER\sma
$env:EXPO_PUBLIC_API_BASE_URL='http://10.0.2.2:3099'
$env:EXPO_PUBLIC_SIMPLYUR_CHECKOUT_ENABLED='1'
npx expo start --port 8081
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3099 tcp:3099
```

Verified 2026-08-10: Plans tab shows **Showing plans for 5 days** + roaming cards via this path.

## Do not default to

- Blocking Android on iOS/Xcode availability
- EAS OTA / Expo Access Token for routine Android QA
- Asking for EAS secrets unless store/push is explicitly requested

## iOS follow-up (GitHub)

`main` already carries the Expo iOS project + Apple Sign-In notes. Resume on a Mac / operator iPhone after pulling this repo — do not re-run EAS as the default Windows QA path.
