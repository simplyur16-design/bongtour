# SimplyUR mobile — local device verification (operator SSOT)

**Locked 2026-08-10.** Also mirrored in local Cursor rule  
`.cursor/rules/simplyur-mobile-local-devices.mdc` (gitignored with `.cursor/`).

## Devices

| Platform | Device |
|----------|--------|
| Android | Virtual device (emulator) |
| iOS | Operator’s personal iPhone |

## Verify loop

Day-to-day: **local native install**, not EAS cloud build / `eas update`.

```bash
cd apps/simplyur-mobile
npx expo run:android          # emulator
npx expo run:ios --device     # personal iPhone (macOS)
```

API base: live `https://bongtour.com`, or Android emulator local API `http://10.0.2.2:3000`, iPhone LAN IP for local Next.

## Do not default to

- `eas build` / `eas update` for routine QA
- Blocking fixes on Expo billing credits or EAS secrets
- Asking for `EXPO_ACCESS_TOKEN` unless push delivery is explicitly requested
