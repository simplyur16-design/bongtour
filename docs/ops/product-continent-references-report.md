# Product.continent 참조 검사 보고서 (Phase 1.5)

검사일: 2026-05-19  
범위: `Product.continent` (Prisma `Product` 모델의 `continent String?` 필드). `continentKey`·`Continent` 마스터 테이블·UI prop 이름 `continents`(마스터 트리)는 본 표에서 제외.  
조치: 검사만 수행. 치환 PR은 별도 지시.

## 요약

| 구분 | 파일 수(대략) | 비고 |
|------|---------------|------|
| 스키마·주석 | 2 | `prisma/schema.prisma` 필드 정의 |
| 등록·지리 정규화(쓰기) | 12+ | `normalizeProductGeoForPrisma` → `...geo` spread |
| 6공급사 parse-and-register | 6 | 핸들러 본문에 `continent` 문자열 없음, `...geo`로 간접 write |
| browse·필터(읽기·where) | 6 | G-3 폴백 `{ continent: … }` Prisma where |
| 어드민 geo-audit | 4 | select·patch·UI 표시 |
| 스크립트 | 2 | `backfill-product-geo-d3.ts` write; country-tag 백필 1단계는 제거됨 |
| 기타 | 4 | gemini-curation, register 미리보기, citykey-fix |

---

## 참조 목록

| 파일 | 라인 | 사용 패턴 | 영향 |
|------|------|-----------|------|
| `prisma/schema.prisma` | 49 | 필드 정의 `continent String?` | 스키마 |
| `prisma/schema.postgres.prisma` | (동일) | 필드 정의 | 스키마 |
| `lib/product-location-key-match.ts` | 46 | 타입 `ProductLocationKeyPrismaFields.continent` | 공통 |
| `lib/product-location-key-match.ts` | 272, 366–376 | `deriveProductLocationKeyFieldsForPrisma` 반환값에 `continent` write | 공통·등록 SSOT |
| `lib/normalize-product-geo.ts` | 3, 65–69 | 주석·`normalizeProductGeoForPrisma`가 tree `continent` 포함 `geo` 반환 | 공통 |
| `lib/normalize-product-geo-master.ts` | 106–113 | `enrichPrismaGeoWithMasterLabels`에서 `continent` 유지·반환 | 공통 |
| `app/api/admin/products/route.ts` | 99–106, 133 | `normalizeProductGeoForPrisma` → `...geo` spread | 어드민·등록 |
| `app/api/admin/products/v2/route.ts` | 91 | `...geo` spread | 어드민 |
| `app/api/travel/parse-and-upsert/route.ts` | 301 | `...geo` spread | 기타 등록 |
| `lib/parse-and-register-hanatour-orchestration.ts` | 1462, 1548 | `normalizeProductGeoForPrisma` 후 `...geo` in `productData` | hanatour |
| `lib/parse-and-register-modetour-handler.ts` | 1711, 1797 | 동일 | modetour |
| `lib/parse-and-register-ybtour-orchestration.ts` | 1466, 1552 | 동일 | ybtour |
| `lib/parse-and-register-verygoodtour-handler.ts` | 1340, 1426 | 동일 | verygoodtour |
| `lib/parse-and-register-kyowontour-orchestration.ts` | 1609, 1688 | 동일 | kyowontour |
| `lib/parse-and-register-lottetour-orchestration.ts` | 1615, 1701 | 동일 | lottetour |
| `lib/geo-audit-tree-from-master.ts` | 11–24 | `deriveTreeGeoFromMasterPrimary` → browse 탭 id `continent` | geo-audit 보조 |
| `lib/browse-country-url-resolve.ts` | — | `browseRegionToDbContinents` 등 슬러그·트리 매핑(클라이언트 안전). browse Prisma where에는 미사용 | 메뉴·URL |
| `lib/browse-master-geo.ts` | — | `ProductCountryTag` / `ProductCityTag` 단일 SSOT (`buildOverseasBrowseGeoResolution`) | browse |
| `lib/match-overseas-product.ts` | 47 | `OverseasProductMatchInput.continentKey` 등(레거시 `continent` 스칼라는 browse where 미사용) | browse·필터 |
| `lib/products-browse-filter.ts` | 63, 79 | `toOverseasMatchInput` — 태그·키 필드 | browse |
| `app/api/products/browse/route.ts` | — | `buildOverseasBrowseGeoResolution` 태그 where만; JP/CN `Product.city` 레거시 OR 제거됨 | browse |
| `app/api/products/browse/route.ts` | — | 응답 매핑 시 `matchProductToOverseasNode`(표시 버킷) | browse |
| `lib/product-browse-full-include.ts` | 7–46 | include만 정의; Product 스칼라 `continent`는 findMany 시 자동 로드 | browse |
| `app/api/admin/products/geo-audit/list/route.ts` | 52, 158, 164, 196, 208 | `select: { continent: true }`; API 응답·suggestion | 어드민 |
| `app/api/admin/products/geo-audit/apply/route.ts` | 205, 225, 269, 279, 398, 404, 422, 470, 503, 523, 536, 618, 624, 643 | select·patch·`product.update` data에 `continent` | 어드민 |
| `app/api/admin/products/geo-audit/skip/route.ts` | 33, 56 | select·skip payload에 `existing.continent` | 어드민 |
| `app/api/admin/products/geo-audit/lib/shared.ts` | 103–116 | suggestion/current `continent` 비교 | 어드민 |
| `app/admin/products/geo-audit/page.tsx` | 46, 134–135, 509 | 타입·UI 「continent (탭)」 표시·검증 플래그 | 어드민 UI |
| `app/admin/register/page.tsx` | 96, 878–879 | 미리보기 `geo.continent` → 요청 body `continent` (DB write는 API `...geo`) | 어드민 UI |
| `lib/gemini-curation.ts` | 53, 115, 131, 264 | select `continent: true`; read; `regionKey`에 사용 | 기타 |
| `lib/product-citykey-country-slug-fix.ts` | 150 | `product.update` `continent: tree.continent` | 스크립트·geo-audit |
| `scripts/backfill-product-geo-d3.ts` | 34, 120, 210, 246 | select·patch·`product.update` `continent` | 스크립트 |
| `scripts/backfill-product-country-tag.ts` | 52, 95 | `toGeo` select만 (태그 sync 입력); **legacy continent 정정 단계 제거됨** | 스크립트 |
| `lib/sync-product-country-tags.ts` | (제거) | `LEGACY_PRODUCT_CONTINENT_TO_TAB_ID` / `normalizeProductContinentTabId` — 백필 1단계 제거로 삭제 | — |

---

## 6공급사 등록 파이프

공급사별 `parse-and-register-*-handler.ts` / `*-orchestration.ts`에는 `continent` 식별자가 **직접 등장하지 않음**.  
모두 `normalizeProductGeoForPrisma` → 반환 `geo` 객체를 `productData` / update data에 `...geo` spread 하여 `Product.continent`에 기록.

| 공급사 | orchestration/handler | normalize 호출 | `...geo` spread |
|--------|----------------------|----------------|-----------------|
| hanatour | `lib/parse-and-register-hanatour-orchestration.ts` | ~1462 | ~1548 |
| modetour | `lib/parse-and-register-modetour-handler.ts` | ~1711 | ~1797 |
| ybtour | `lib/parse-and-register-ybtour-orchestration.ts` | ~1466 | ~1552 |
| verygoodtour | `lib/parse-and-register-verygoodtour-handler.ts` | ~1340 | ~1426 |
| kyowontour | `lib/parse-and-register-kyowontour-orchestration.ts` | ~1609 | ~1688 |
| lottetour | `lib/parse-and-register-lottetour-orchestration.ts` | ~1615 | ~1701 |

공통 의존: `lib/product-location-key-match.ts` (`deriveProductLocationKeyFieldsForPrisma`), `lib/normalize-product-geo-master.ts`.

---

## 치환 PR 시 참고 (본 문서는 미적용)

- browse G-3: `lib/browse-master-geo.ts`의 `{ continent: … }` where → `continentKey` / 태그·MegaMenuGroupCard 경유로 대체 검토.
- in-memory 필터: `lib/match-overseas-product.ts`의 `product.continent` 비교 → `continentKey` 우선으로 이미 일부 병행 중.
- 등록: `deriveProductLocationKeyFieldsForPrisma`에서 `continent` 출력 중단 시 6공급사 `...geo` spread 동시 정리 필요.
- DB 컬럼 drop은 애플리케이션 참조 제거·백필 검증 후 별도 migration.
