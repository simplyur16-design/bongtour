# 메가메뉴 ↔ 상품 geo 태그 계약 (흔들리지 않게)

browse·메가메뉴 필터는 **`ProductCountryTag` / `ProductCityTag`만** 본다.  
`Product.cityKey`·`Product.country` 한글 필드만으로는 도시·열(`menuGroup`) 클릭에 잡히지 않는다.

## 등록 시 필수 (4공급사 공통)

1. **`syncProductGeoTags`만** 호출한다 (`syncProductCountryTags` 단독 호출 금지).
2. 흐름: `normalizeProductGeoForPrisma` → `Product` FK → **`syncProductGeoTags`**.
3. 구현: `lib/sync-product-geo-tags.ts` → `sync-product-country-tags` + `sync-product-city-tags` + 보조 국가 태그.

## 도시 태그 규칙

| 상황 | 동작 |
|------|------|
| 단일 도시 | 메가메뉴에 있는 `cityKey` 1건 primary `ProductCityTag` |
| 다도시 클러스터 | `lib/cluster-city-expansions.ts` 펼침 → **메가메뉴에 있는 도시만** 다건 태그 |
| 제목·목적지에 여러 도시 | `lib/mega-menu-master-city-keys.ts` 토큰 매칭 → 메가메뉴 집합 ∩ |
| 메가메뉴에 없는 도시 | 태그 **안 함** (의도적) |
| 국가만 매칭 | `ProductCountryTag`만 (도시 문자열 없으면 도시 태그 생략 가능) |

## URL ↔ 메가메뉴

- 열(홋카이도·화동·미서부 등): `menuGroup` 쿼리 + `country` (일본·중국 등).
- SSOT: `lib/mega-menu-regions.data.ts`, `lib/top-nav-resolve.ts`, `lib/browse-master-geo.ts`.

## 회귀 방지 (E2E 제외)

```bash
npx tsx scripts/verify-mega-menu-ssot-browse.ts
npm run backfill:product-city-tag          # 누락 ProductCityTag
npm run backfill:product-country-tag       # 누락 ProductCountryTag
```

`registered` + `cityKey` 있는데 `ProductCityTag` 없으면 verify 스크립트가 실패한다.

## LLM·파서 정리와의 관계

공급사별 LLM 출력이 바뀌어도 **저장 직전 `geo` + `syncProductGeoTags`**만 맞으면 메가메뉴 정합은 유지된다.  
파서 정리 시 이 계약 파일·verify 스크립트를 **먼저** 깨지 않는지 확인한다.

### 등록 SSOT (A안 — `lib/register-resolve-mega-menu-geo.ts`)

4공급사 confirm은 **`resolveMegaMenuGeoForRegister`** 한 곳만 호출 → `normalizeProductGeoForPrisma` + `detectMultiCountryAutoPlan` + 이후 `syncProductGeoTags`.

- **다국가**: 목적지→제목 haystack, 트리·메가메뉴 도시 토큰. **N국 없어도 2개국 이상이면 medium** → 다건 `ProductCountryTag`.
- **1글자 국명(괌)**: `matchProductToOverseasNode` 선행 매칭 (호텔명 닛코 오매칭 완화).
- **다국가 nodeKey**: 보조 국가 태그에 `defaultNodeKeyForMasterCountryTag` (예: `denmark-mix`).
- **pending**: 다국가 `confidence === 'low'` 또는 마스터 bar 실패만.
