# 국내여행 서브 메인 (`/travel/domestic`)

## 역할

- **상단 1차 메뉴 5개**: 지역별 · 일정별 · 테마별 · 대상별 · 특별기획 (`DomesticTravelSubMainNav`, 데이터 `lib/domestic-landing-nav-data.ts`).
- **히어로 빠른 칩**: 동일 데이터로 `?dmPillar=&dmItem=` + `#travel-dm-products` 링크.
- **권역 트리**: `DomesticRegionExplorer` — 탐색·교육용; 상품 필터는 토큰으로 `HomeProductPickSection`에 전달.
- **상품 영역**: 좌측 `DomesticRefineSidebar`(정교한 좁히기) + 우측 카드 그리드; 해외 서브메인과 같이 **본문 전용 서브 네비** 패턴.
- **월별 큐레이션**: 특별기획 「시즌추천」에서 `#travel-dm-curation` 스크롤 연계.
- 카피·CTA: 예약 확정 톤 지양, **상담 신청** 계열 (`DomesticHero`, 하단 `#travel-dm-cta`).

## 메타 SSOT

| 파일 | 내용 |
|------|------|
| `lib/domestic-location-tree.types.ts` | `DomesticLeafNode`, `DomesticAreaNode`, `DomesticRegionGroupNode` |
| `lib/domestic-location-tree.data.ts` | `DOMESTIC_LOCATION_TREE_DATA` |
| `lib/domestic-location-tree.ts` | export, `matchTokensForDomestic*` |
| `lib/travel/domestic-location-tree.ts` | 재수출 |

## 활성 트리

- `lib/active-domestic-location-tree.ts` — `filterProductsForDomesticDestinationTree` (제목 휴리스틱 `domestic` 만), `buildActiveDomesticLocationTree`.
- `app/travel/domestic/page.tsx` 에서 Prisma로 메타 조회 후 파생 트리를 셸에 전달.

## 상품 매칭

- `lib/match-domestic-product.ts` — 해외와 동일 haystack 순서, `productMatchesDomesticDestinationTerms`, `matchProductToDomesticNode`.
- `HomeProductPickSection` (`market="domestic"`): 지역 `destinationFilterTerms` + 테마 `themeFilterTerms` **AND**.

## 탭

- **지역별**: `DomesticRegionExplorer`
- **추천여행**: 월별 큐레이션 본체(하단 슬롯), 상단 리드만 보조
- **공급사별**: `normalize-supplier-origin` 키 필터
- **테마여행**: 버스/기차/당일/박 수/반려/크루즈 등 칩 → `themeFilterTerms`

## 에디토리얼

- `DomesticEditorialSection` + `lib/domestic-landing-copy.ts` 의 `DOMESTIC_EDITORIAL_SAMPLES` (수원 방문의 해 등 샘플).
- 상품 카드와 시각·톤 분리.

## 관련

- 전세·단체: 에디토리얼 하단에서 `/charter-bus` 링크.
