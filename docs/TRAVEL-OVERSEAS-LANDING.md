# 해외여행 서브 메인 (`/travel/overseas`)

## 역할

- **검색·조건(상단)** 이 1차, **권역 → 국가 → 도시** 탐색은 검색 아래 **보조(빠른 목적지 탐색)** 로 둔다.
- **4분기 탭**: **나라별(기본)** · 추천여행 · 공급사별 · 자유여행 — 상품 결과·검색과 **보완 관계**이지, 페이지를 완전히 갈라 놓지 않는다.
- **상품 블록**은 여행사형 **비교 카드**(`OverseasCompareCard`)·결과 건수·정렬로 읽힌다.
- 그 다음 **에디토리얼(브리핑)** → **월별 큐레이션** — 상품과 **톤·목적이 다른 축**이다.

## 메타 SSOT (통합 트리)

| 파일 | 내용 |
|------|------|
| `lib/overseas-location-tree.types.ts` | `OverseasLeafNode`, `OverseasCountryNode`, `OverseasRegionGroupNode` |
| `lib/overseas-location-tree.data.ts` | `OVERSEAS_LOCATION_TREE_DATA` 본문 |
| `lib/overseas-location-tree.ts` | export, `matchTokensForLeaf` / `Country` / `Group`, **shallow** 토큰(leaf 제외 국가·권역만) |
| `lib/travel/overseas-location-tree.ts` | 위 모듈 재수출 |

- **국가 노드**는 엄밀한 국가만이 아니라, 일본 **간토·간사이** 등 공급사 메뉴의 **세부 권역**도 포함한다.
- **UI 라벨**은 봉투어 표준, **공급사식 표기**는 `aliases` / `supplierKeywords` / `supplierOnlyLabels` 로 매칭에 흡수한다.
- `nodeType`: `city` | `region` | `route` | `theme` — 광역·루트형 목적지 표시에 사용.

## 공급사 분류 반영 원칙

- 하나투어·모두투어 메뉴를 **운영 권역**으로 통합(지리 대륙보다 상품 메뉴 우선).
- 화면 문자열과 DB `originSource` 흔들림은 **`lib/normalize-supplier-origin.ts`** 로 내부 키에 수렴:  
  `hanatour` | `modetour` | `verygoodtour` | `ybtour` | `etc`
- 해외 랜딩 **공급사별** 탭은 이 정규화 키로 필터한다(부분 문자열 칩 나열 방식 대체).

## 상단 검색·필터

| 파일 / 컴포넌트 | 내용 |
|------------------|------|
| `lib/overseas-landing-search.ts` | `OverseasLandingSearchState`, 빠른 칩 `OVERSEAS_QUICK_FILTER_CHIPS`, `productMatchesOverseasQuickChipIds` (칩별 OR·칩 간 AND) |
| `app/components/travel/overseas/OverseasSearchPanel.tsx` | 목적지 자유검색·출발일·출발지(표시)·유형·가격·공급사·정렬·빠른 칩 |
| `HomeProductPickSection` | `overseasLandingSearch` + `refineOverseasGalleryRows`(문자열·일자·가격·출발지 substring) + 정렬 |

- 검색바에서 고른 공급사가 있으면 **탭 공급사 필터보다 우선**(`supplierKeyFromLandingPick`).
- 여행 유형 칩이 패키지/자유면 해당 **픽 탭**으로 맞춤.

## 상품 매칭 원칙

| 단계 | 내용 |
|------|------|
| 클라이언트 필터 | `lib/match-overseas-product.ts` — `productMatchesOverseasDestinationTerms` |
| Haystack 구성 순서 | `primaryDestination` → `destinationRaw` → `primaryRegion` → 레거시 `destination` → `title` → `originSource` |
| 트리 토큰 | 탐색에서 넘긴 `terms[]`가 위 문자열(소문자 합본)에 **부분 일치**하면 통과 |
| 역매칭·로그 | `matchProductToOverseasNode(product)` — leaf → country(shallow) → group(shallow) 순 최장 토큰 우선 |

- 갤러리 API `GET /api/gallery` 응답 `GalleryProduct`에 위 목적지 필드를 포함한다.
- 유형(패키지/자유) 분류는 기존처럼 **제목 휴리스틱**(`lib/gallery-product-triage.ts`).

## 활성 목적지 트리 (상품 없는 노드 숨김)

- 원본 메타는 `OVERSEAS_LOCATION_TREE` / `_CLEAN` 에 그대로 둔다.
- **`lib/active-overseas-location-tree.ts`**
  - `filterProductsForOverseasDestinationTree` — 국내로 분류되는 제목 제외 후 해외·자유만 사용.
  - `buildActiveOverseasLocationTree(products)` — 파생 트리:
    - **leaf**: 해당 leaf 토큰과 맞는 상품이 1건 이상일 때만 표시.
    - **country**: 활성 leaf가 있거나, **국가 shallow 토큰**만 맞는 상품이 있을 때 표시(이때 leaf 목록은 비어 있을 수 있음 → 「국가 전체」만 안내).
    - **group**: 활성 country가 1개 이상일 때만 표시.
- `app/travel/overseas/page.tsx` 가 서버에서 `prisma.product` 로 필드를 읽어 `activeLocationTree` 를 만들고 `OverseasInteractiveShell` → `OverseasCountryCityExplorer` 로 전달한다.
- 상품이 하나도 없으면 탐색 블록에 **빈 트리 안내**만 보이고, 에디토리얼·큐레이션은 그대로 유지한다(브리핑 축 분리).

## 테스트·샘플 상품 삭제

- 판별 기준·요약: **`lib/overseas-test-product-policy.ts`**
- 실행 스크립트: **`scripts/purge-test-products.ts`**
  - 기본 실행: 조회·분류만(드라이런).
  - `npx tsx scripts/purge-test-products.ts --apply --mode markers` — 상품명/코드/출처에 **명시적 테스트 표식**이 있는 행만 삭제(운영 대기 `pending` 만으로는 삭제하지 않음).
  - `npx tsx scripts/purge-test-products.ts --apply --mode markers --overseas-only` — 위 **표식 매칭** 중에서도 제목 분류가 **해외 패키지·자유형**인 상품만 삭제(국내 테스트는 제외).
  - `npx tsx scripts/purge-test-products.ts --apply --mode non-registered --confirm-non-registered` — `registered` 가 아닌 상품 일괄 삭제(로컬 DB 초기화용, **위험**).
  - **Booking** 이 연결된 `Product` 는 삭제 스킵.
  - 삭제 전 `ScraperQueue` 정리, `AgentScrapeReport.productId` 는 null 처리 후 `product.deleteMany`.
- `DATABASE_URL` 이 올바른 SQLite를 가리키는지 확인할 것. 테이블이 없으면 `prisma db push` 등으로 스키마를 먼저 맞춘다.
- 삭제 후 `/travel/overseas` 에서 활성 트리가 비어 안내 문구로 전환되는지, 상품·empty state 가 자연스러운지 확인한다.

## `primaryDestination` 정합화 (향후)

- 스크래퍼·관리자에서 `primaryDestination` / `destinationRaw` 를 채울수록 나라별 필터 정확도가 오른다.
- 비어 있으면 **제목·originSource**에만 의존하므로, 운영 시 우선순위 필드 채우기를 권장한다.

## 국내여행 재사용

- **트리 + shallow 토큰 + haystack 순서** 패턴을 국내용 메타(`domestic-*`)에 복제하기 쉽게 모듈을 분리해 두었다.
- 공급사 정규화는 해외 키이지만, 동일 패턴으로 `normalize-supplier-origin` 형제 모듈을 두면 된다.

## 섹션 순서 (현재)

1. Header  
2. Hero (`OverseasHero`) — 짧은 카피  
3. **검색** (`OverseasSearchPanel`, `#travel-os-search`)  
4. 2차 탭 (`OverseasSecondaryTabs`) — 기본 **나라별**  
5. 앵커: 브리핑 · 상담  
6. **빠른 목적지 탐색** (`OverseasCountryCityExplorer`, `layout="auxiliary"`) — 나라별 탭일 때만  
7. 공급사별 칩 행 — 공급사별 탭일 때  
8. **상품** (`HomeProductPickSection`, `market="overseas"`, `overseasCompareLayout`, 갤러리 limit 48, 최대 12건 표시)  
9. **에디토리얼** (`OverseasEditorialSection`)  
10. **월별 큐레이션** (`TravelLandingCuration`)  
11. CTA  

## 카피·UX

- 탭별 리드·empty state·추천 비어 있음 문구는 `lib/overseas-landing-copy.ts`, `HomeProductPickSection`, `MonthlyCurationSection` 에 분기한다.
