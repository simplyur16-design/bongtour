# 국내여행 공개 페이지 (`/travel/domestic`) — 폐지

**2026-05:** 공개 IA에서 국내여행 허브를 제거했습니다.

- **`/travel/domestic`** → **`/travel/overseas`** 로 **308 permanent redirect** (`app/travel/domestic/page.tsx`)
- 사이트맵·OG 관리자 페이지 키 `domestic` 제거
- 공개 UI 컴포넌트 `app/components/travel/domestic/*` 삭제

## 유지 (운영·데이터)

- DB `Product.travelScope = 'domestic'` 및 관리자 등록·월별 큐레이션 `scope=domestic`
- `lib/domestic-*` — browse API `scope=domestic`, 지역 매칭, 갤러리 분류
- 메인 허브 **관리자** 이미지 키 `domestic` (공개 4카드에는 미노출)
- 국내 상품 상세 breadcrumb: **국내여행** 라벨 → 링크 **`/products`**

## 레거시

- 북마크·외부 링크는 redirect로 처리됩니다.
- `DomesticInteractiveShell` 등 미연결 UI는 제거되었습니다.
