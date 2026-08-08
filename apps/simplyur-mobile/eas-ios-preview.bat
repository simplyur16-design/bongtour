@echo off
setlocal EnableExtensions
title simplyur-eas-ios
color 07
cd /d "C:\Users\USER\Desktop\BONGTOUR\apps\simplyur-mobile"

set "EXPO_DEBUG=false"
set "EXPO_OFFLINE=false"
set "EXPO_NO_DOTENV=false"
set "CI=false"
set "FORCE_COLOR=0"
set "npm_config_loglevel=error"
REM Skip Apple capability auto-sync (Sign in with Apple must be set manually in Developer portal)
set "EXPO_NO_CAPABILITY_SYNC=1"

echo EXPO_DEBUG=%EXPO_DEBUG%  EXPO_NO_CAPABILITY_SYNC=%EXPO_NO_CAPABILITY_SYNC%
echo.
echo Before this build, in Apple Developer portal enable:
echo   Identifiers -^> com.bongtour.simplyur -^> Sign In with Apple = ON
echo   https://developer.apple.com/account/resources/identifiers/bundleId/edit/36VM8LHHT6
echo.
echo Then answer Apple prompts with y if asked again.
echo.

"C:\Program Files\nodejs\npx.cmd" --yes eas-cli@latest build --platform ios --profile preview
echo.
echo Exit=%ERRORLEVEL%
pause
