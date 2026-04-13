# 국내여행 공개 페이지 (`/travel/domestic`)

## 현재 구조 (공개 경로)

- **`app/travel/domestic/page.tsx`**: `Header` → `DomesticHero` → `DomesticResultsShell` (`Suspense`).
- **`DomesticResultsShell`**: `ProductsBrowseClient`만 사용 (`basePath=/travel/domestic`, `defaultScope=domestic`).
- **상단 하위메뉴 없음** · **좌측/모바일 필터 UI 없음** · **필터 칩 없음**.
- 상품 목록은 **`ProductResultsList`의 지역별 섹션 모드**(`groupDomesticByRegion`): 제주 → 강원 → 부산/경상 → 전라 → 충청 → 수도권 → 기타(고정 순서, 해당 지역에 상품이 있을 때만 섹션 노출). 섹션 내 카드는 기존 `ProductResultCard`·상세 링크 유지.
- 공개 허브 URL에서는 레거시 쿼리(`dmPillar`, `dmItem`, `regionPref`, `domesticTransport`, `domesticSpecialTheme` 등)는 **클라이언트에서 browse 요청에 넣지 않음**(북마크에 남아 있어도 목록 동작은 동일 기준).

## 레거시·내부 SSOT (공개 메인 경로와 분리)

- **`lib/domestic-landing-nav-data.ts`**: `DOMESTIC_NAV_PILLARS`, `parseDomesticUrlNav` 등 — **browse API**(`app/api/products/browse`)·`lib/domestic-public-browse-match.ts`·갤러리형 **`DomesticInteractiveShell`** 등에서 여전히 참조될 수 있음. 공개 `/travel/domestic` 메인 플로우에서는 상단 탭 UI로 노출하지 않음.
- **`DomesticInteractiveShell`**: 현재 **어떤 `page`에서도 import되지 않음**(보관용/실험 셸). URL `initialDmPillar` / `initialDmItem`으로 초기 상태를 파싱하는 로직만 유지 가능.

## 지역·상품 매칭

- **`lib/domestic-location-tree*.ts`**, **`lib/match-domestic-product.ts`**: 지역 트리·상품 haystack 매칭(지역 섹션 분류에 재사용).
- **`lib/active-domestic-location-tree.ts`**: 등록 상품 기준 활성 트리·browse 풀 필터 등.

## 카피·CTA

- `DomesticHero`, 상담 링크 등 — 예약 확정 톤 지양, 문의·상담 유도.

## 관련

- 전세·단체 등: 에디토리얼·다른 페이지에서 `/charter-bus` 등으로 분리 링크 가능.
