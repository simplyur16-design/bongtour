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

Use a short clone for native builds:

```powershell
git clone https://github.com/simplyur16-design/bongtour.git D:\bt
cd D:\bt\apps\simplyur-mobile
copy .env.example .env   # set EXPO_PUBLIC_API_BASE_URL=https://bongtour.com
npm install
$env:GRADLE_USER_HOME='D:\gradle-home'
npx expo run:android
```

## Do not default to

- Blocking Android on iOS/Xcode availability
- EAS OTA / Expo Access Token for routine Android QA
- Asking for EAS secrets unless store/push is explicitly requested
