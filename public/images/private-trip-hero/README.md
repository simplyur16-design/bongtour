# 우리여행 히어로 이미지 (레거시 폴더)

공개 `/travel/overseas/private-trip` 상단과 관리자 우리여행 히어로는 **Supabase Storage** 버킷 접두사 `private-trip-hero/` 만 사용합니다.

이 디렉터리(`public/images/private-trip-hero/`)는 과거 폴백용으로 남아 있을 수 있으며, **현재 앱 코드 경로에서는 읽지 않습니다.** 필요 없으면 비워 두거나 정리해도 됩니다.

## 관리자 업로드 (권장)

**메인 허브 이미지** 관리 화면의 「우리여행 히어로」에서 올리면 WebP로 변환되어 Storage에 저장됩니다.

- **비율**: 1920×640 기준 cover  
- **형식**: WebP (품질 약 80)  
- **파일명**: ASCII 안전 이름

**nginx 413:** `client_max_body_size`를 늘리거나, 브라우저 직접 업로드(SUPABASE_ANON_KEY 설정)를 사용하세요.
