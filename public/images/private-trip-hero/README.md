# 우리여행 히어로 전용 이미지

## Supabase Storage (운영 권장)

서버에 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`가 있으면, 관리자 업로드는 **Supabase 버킷**(`SUPABASE_IMAGE_BUCKET`, 기본 `bongtour-images`) 안 접두사 **`private-trip-hero/`** 로 WebP가 올라가고, 우리여행 페이지는 그 **공개 URL**로 슬라이드합니다. 이 폴더는 비어 있어도 됩니다.

**nginx 413 회피:** 배포에 `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 넣고 다시 빌드하면, 관리자는 원본을 **브라우저 → Supabase Storage**로 직접 올린 뒤 서버가 WebP로 마무리합니다(대용량이 우리 도메인 `client_max_body_size`에 덜 걸림).

## 이 디렉터리(`public/images/private-trip-hero/`) — 폴백

Storage에 파일이 **없고**, Supabase도 미설정이면, 이 **폴더 루트에만** 이미지를 두면 `/travel/overseas/private-trip` 상단 히어로가 **파일명 순**으로 자동 슬라이드합니다.

- 지원 확장자: `.jpg` `.jpeg` `.png` `.webp` `.gif` `.avif`
- 하위 폴더는 스캔하지 않습니다.
- Storage에 한 장이라도 있으면 Storage가 최우선이고, 그다음 이 폴더, 둘 다 비면 `public/data/private-trip-hero-slides.json` 이 적용됩니다.

## 관리자 업로드 (권장)

**메인 허브 이미지** 페이지 → 「우리여행 히어로」에서 파일을 올리면 서버가 자동으로:

- **비율**: 와이드 히어로용 **1920×640**에 맞춰 중앙 기준 **cover** 크롭  
- **형식·용량**: **WebP**로 통일 (품질 약 80)  
- **파일명**: URL·nginx와 맞추기 위해 **영문·숫자·`-`·`_` 위주의 ASCII 이름**으로 저장합니다(원본 한글명은 파일명에 그대로 쓰이지 않을 수 있음).

직접 이 폴더에 넣을 때도 **파일명은 ASCII만** 쓰는 것을 권장합니다. 예전에 한글 등으로 저장된 파일이 깨져 보이면, 이름을 `something.webp` 형태로 바꾸거나 관리자에서 다시 업로드하세요.

## 운영(nginx)에서 업로드가 안 될 때

업로드 요청이 **nginx `client_max_body_size`** 보다 크면 **413**으로 끊기고, 브라우저에는 JSON이 아닌 HTML이 돌아올 수 있습니다. 저장소의 `deploy/nginx-bongtour-site.conf.example` 처럼 **최소 35m** 정도로 두고 `nginx -s reload` 한 뒤 다시 시도하세요. (앱 한도는 `lib/private-trip-hero-constants.ts`의 `PRIVATE_TRIP_HERO_UPLOAD_MAX_BYTES` 참고.)
