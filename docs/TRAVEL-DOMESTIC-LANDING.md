# 국내여행 공개 페이지 (`/travel/domestic`) — 폐지

**2026-05:** 공개 IA에서 국내여행 허브를 제거했습니다. **2026-08:** 관리자 등록·월 큐레이션·상품 편집에서도 국내 선택지를 제거했습니다. 봉투어는 국내여행을 운영하지 않습니다.

- **`/travel/domestic`** → **`/travel/overseas`** 로 **308 permanent redirect** (`app/travel/domestic/page.tsx`)
- 사이트맵·OG 관리자 페이지 키 `domestic` 제거
- 공개 UI 컴포넌트 `app/components/travel/domestic/*` 삭제
- 관리자 등록 travelScope·월 큐레이션 create scope·상품 편집 범위는 **해외만**

## 데이터 잔여 (운영 아님)

- DB `Product.travelScope = 'domestic'` 레거시 행은 해외 browse에서 제외한다 (`NOT domestic` 필터).
- `/travel/domestic` 북마크는 redirect로 처리한다.
