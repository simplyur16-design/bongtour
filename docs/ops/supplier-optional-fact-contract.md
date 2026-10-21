# 옵션 사실 필드 계약 (supplier-product-fact-ssot)

**없음 ≠ 정보 없음.** `hasOptionalTours === false` → 없음, `true` → 있음, `null` → 정보 없음.

## 저장

| 필드 | 의미 |
|------|------|
| `hasOptionalTours` | Product 스칼라 (비교·칩) |
| `optionalToursStructured` | 구조화 행 JSON |
| `rawMeta.structuredSignals.hasOptionalTour` | 등록 파서 원본 |
| `rawMeta.structuredSignals.optionalToursPasteRaw` | 복붙 원문 |

등록 write: `buildRegisterProductFactWrite` → Product `hasOptionalTours` + `rawMeta.structuredSignals.hasOptionalTour` 동일.  
`hasOptionalTour === false`를 `?? null`로 지우지 않음.

## 도출 우선순위 (`deriveOptionalFact`)

1. Product `hasOptionalTours`
2. structured 행 수 > 0 → yes
3. rawMeta canonical rows → yes
4. 본문/제목 `노옵션` / `#NO옵션` → no, `현지옵션 있음` → yes
5. rawMeta `hasOptionalTour` boolean
6. unknown

**자유여행(`listingKind=air_hotel_free`)**: 옵션 표·canonical·복붙이 있으면 패키지와 같이 `optionalToursStructured`에 첨부하고 `hasOptionalTours=true`. 에어텔이라고 옵션 축을 건너뛰지 않음.

행 게이트·이름 SSOT는 공급사별 `optional-tour-row-gate-*` 유지 (본 계약은 스칼라만).

## verify

`lib/supplier-product-fact-ssot.test.ts` · freeze id `supplier-product-fact-ssot`
