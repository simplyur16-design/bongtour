# Local Gradle production AAB. Not EAS.
# Short path D:\sy2 — ninja fails on Desktop\BONGTOUR 260-char CMake paths.
$ErrorActionPreference = 'Stop'
$Src = 'C:\Users\USER\Desktop\BONGTOUR\apps\simplyur-mobile'
$Dst = 'D:\sy2'
$Jdk = 'C:\Program Files\Android\Android Studio\jbr'
$KsProps = 'D:\simplyur-release\keystore.properties'
$OutAab = 'C:\Users\USER\Desktop\BONGTOUR\simplyur-1.0.0-12-local.aab'
$OutAabCopy = 'C:\Users\USER\Desktop\BONGTOUR\apps\simplyur-mobile\aab\simplyur-1.0.0-12-local.aab'

if (-not (Test-Path $KsProps)) { throw "Missing $KsProps — Play upload keystore" }
if (-not (Test-Path "$Jdk\bin\java.exe")) { throw "Missing JDK at $Jdk" }

$env:JAVA_HOME = $Jdk
$env:ANDROID_HOME = 'C:\Users\USER\AppData\Local\Android\Sdk'
# Prefer the correctly named NDK folder (27.0 path incorrectly contains 27.1 package metadata).
$env:ANDROID_NDK_HOME = 'C:\Users\USER\AppData\Local\Android\Sdk\ndk\27.1.12297006'
$env:GRADLE_USER_HOME = 'D:\gradle-home'
# Android Studio JBR is OpenJDK 25 — CMake/native configure needs native access.
$env:JAVA_TOOL_OPTIONS = '--enable-native-access=ALL-UNNAMED'
$env:PATH = "C:\Program Files\nodejs;$Jdk\bin;$env:PATH"
$env:EXPO_PUBLIC_API_BASE_URL = 'https://bongtour.com'
$env:EXPO_PUBLIC_SIMPLYUR_CHECKOUT_ENABLED = '1'
# Play Console rejects reused versionCode (11 already used).
$env:SIMPLYUR_VERSION_CODE = '12'
$OutAab = 'C:\Users\USER\Desktop\BONGTOUR\simplyur-1.0.0-12-local.aab'
$OutAabCopy = 'C:\Users\USER\Desktop\BONGTOUR\apps\simplyur-mobile\aab\simplyur-1.0.0-12-local.aab'

New-Item -ItemType Directory -Path $Dst -Force | Out-Null
& robocopy $Src $Dst /E /XD node_modules android\app\.cxx android\app\build android\build android\.gradle .expo dist .git aab /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $LASTEXITCODE" }

Set-Location $Dst
# Always install — robocopy skips node_modules, so new deps (e.g. qrcode-svg) would otherwise miss.
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

$envFile = Join-Path $Dst '.env'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k, $v = $_.Split('=', 2)
    if ($k -and $v) { Set-Item -Path "Env:$k" -Value $v }
  }
}

$gradle = Join-Path $Dst 'android\app\build.gradle'
if (-not (Test-Path $gradle)) { throw "android project missing at $gradle — generate it locally first" }

$patch = Join-Path $Src 'scripts\patch-android-release-signing.js'
node $patch $gradle $KsProps
if ($LASTEXITCODE -ne 0) { throw "gradle patch failed" }

foreach ($stale in @(
  (Join-Path $Dst 'android\app\build'),
  (Join-Path $Dst 'android\build'),
  (Join-Path $Dst 'android\app\.cxx'),
  (Join-Path $Dst 'node_modules\react-native-screens\android\build'),
  (Join-Path $Dst 'node_modules\react-native-reanimated\android\build'),
  (Join-Path $Dst 'node_modules\react-native-worklets\android\build'),
  (Join-Path $Dst 'node_modules\expo-updates\android\build')
)) {
  if (Test-Path $stale) { Remove-Item -Recurse -Force $stale }
}

Set-Location (Join-Path $Dst 'android')
# lintVital* has hung >1h on this machine; AAB does not need it for local Play upload artifact.
.\gradlew.bat bundleRelease --no-daemon -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease
if ($LASTEXITCODE -ne 0) { throw "gradle bundleRelease failed" }
$aab = Join-Path $Dst 'android\app\build\outputs\bundle\release\app-release.aab'
if (-not (Test-Path $aab)) { throw "AAB missing: $aab" }
New-Item -ItemType Directory -Force -Path (Split-Path $OutAab) | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $OutAabCopy) | Out-Null
Copy-Item -Force $aab $OutAab
Copy-Item -Force $aab $OutAabCopy
Write-Output "OK $OutAab"
Write-Output ("bytes=" + (Get-Item $OutAab).Length)
Write-Output "also $OutAabCopy"
