# 메가메뉴 ↔ 상품 목록 맞추기 (운영 플레이북)

browse·메가메뉴 클릭은 **`ProductCountryTag` / `ProductCityTag`만** 본다. 상품 `country`·`city` 한글만 맞춰도 목록에 안 나올 수 있다.

## 4층 정합

| 층 | SSOT | 검증 |
|----|------|------|
| UI leaf | `lib/mega-menu-regions.data.ts` | `npm run verify:mega-menu-register-alignment` |
| browse URL | `lib/browse-country-url-resolve.ts` | 동일 + `tests/mega-menu-mongolia-macau-geo.test.ts` |
| 등록 geo | `resolveMegaMenuGeoForRegister` + `syncProductGeoTags` | 신규 등록 후 메뉴 클릭 |
| DB 태그 | `ProductCountryTag` / `ProductCityTag` | `npm run verify:mega-menu-browse` (DB 필요) |

## 신규 등록 (앞으로)

1. LLM·파서가 `primaryDestination`·`destinationRaw`를 채운다.
2. confirm 시 `buildRegisterGeoHaystackFromSchedule`로 일정 전체가 **도시 태그 haystack**에 들어간다.
3. 마스터 미달·다국가 애매 → `registrationStatus: pending` (임의 메뉴 배치 금지).

## 기존 상품 (이미 등록됨)

```bash
npm run resync:mega-menu-geo          # dry-run 리포트
npm run resync:mega-menu-geo:apply    # geo + Country/City 태그 재동기화
```

스테이징·운영 DB에서 실행. 로컬 Postgres 없으면 browse verify는 실패한다.

## 정적 갭 조사

```bash
npm run audit:geo-master-static
```

메뉴 **browse 슬러그**와 트리 **countryKey**를 직접 비교하므로 “83개 도시 누락”처럼 과대 보고될 수 있다.  
실제 수정은 `resolveBrowseCityKeysForFilter` 결과·트리 leaf `nodeKey` 기준으로 `verify:mega-menu-register-alignment`를 우선한다.

## 흔한 불일치 원인

- **내몽골 vs 몽골**: `울란바타르` 별칭에 `몽골`이 있으면 substring으로 오매칭 → `lib/geo-haystack-match.ts` 음절 경계 + 트리 별칭 정리.
- **메뉴에만 있는 도시**: 트리 `overseas-location-tree.data.ts`에 leaf 추가 (예: `terelj`).
- **마카오**: 국가 leaf — URL `country=macau`, `ProductCountryTag` `macau`.
- **일정에만 있는 도시**: `scheduleHaystack` 없이 등록하면 `ProductCityTag` 누락.

## 100% 보장이 아닌 경우

- 메가메뉴에 없는 도시는 의도적으로 도시 태그를 안 붙인다.
- 제목·목적지·일정에 도시명이 없으면 매칭 실패 → `pending`.
- 국가-only leaf(`LC`)는 도시 태그 없이 국가 태그만.

상세 계약: `docs/ops/mega-menu-geo-tags-contract.md`.
