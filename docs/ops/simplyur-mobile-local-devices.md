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

## Do not default to

- Blocking Android on iOS/Xcode availability
- EAS OTA / Expo Access Token for routine Android QA
- Asking for EAS secrets unless store/push is explicitly requested
