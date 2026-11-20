# Android build.gradle fixtures

Pristine `android/app/build.gradle` templates used by
`src/lib/android-release-signing.test.ts` to check `scripts/patch-android-release-signing.js`.

- `expo-sdk51-app.build.gradle` — old template (`expo-template-bare-minimum@51.0.56`, npm).
- `expo-sdk57-app.build.gradle` — new template (`node_modules/expo/template.tgz`, expo@57.0.18).

Templates only. No keystore paths, passwords, or other secrets.
