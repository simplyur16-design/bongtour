# 모두투어(modetour) 본문 해석 — 공급사 고정 계약

이 문서는 **모두투어 본문 구조**에 맞춘 파싱·병합만을 다룬다. 다른 공급사(참좋은여행, 노랑풍선, 하나투어 등)에 동일 규칙을 공통 적용하지 않는다.

**본문 줄 단위 섹션 분리(앵커·슬라이스):** `docs/body-parser-modetour-ssot.md` — 등록 시 `DetailBodyParseSnapshot`을 만드는 1급 SSOT. 본 문서는 **항공 directed·가격·공개 leg 병합**에 초점을 둔다.

## 항공

- **모듈**: `lib/flight-modetour-parser.ts` — 파일 전체가 모두투어 전용.
- **Directed / flightRaw·normalized 폴백**: `buildModetourDirectedDisplayFromStructuredBody` 등. 호출은 `brandKey === 'modetour'` 또는 `flightStructured.debug.supplierBrandKey === 'modetour'`로 확정된 경로만 (공개 상세 `page.tsx`, 등록 파이프라인의 modetour 분기).
- **출발일별 leg 카드 enrich**: `departure-key-facts`에서 `tryModetourDepartureLegCardsFromStructuredBody`는 **`FlightStructuredBody.useModetourStructuredFlightLegs === true`일 때만** 호출. 플래그는 공개 `page.tsx`가 위 modetour 조건일 때만 설정.

## 가격

- **본문 라벨 추출 보강**: `extractProductPriceTableByLabels` + `mergeProductPriceTableWithLabelExtract`는 유틸로 공급사 비특정이나, **공개 상세에서 병합 결과를 merge에 넘기는 것**은 `page.tsx`의 modetour 분기에서만.
- **날짜별 성인가와 아동/유아**: `mergeProductPriceRowsWithBodyPriceTable`의 `modetourVaryingAdultChildLinkage`는 **모두투어 전용 옵션**. `page.tsx`가 modetour일 때만 세 번째 인자로 전달.

## 공통으로 유지되는 것

- `ProductDeparture` / `ProductPriceRow` / `rawMeta.structuredSignals` 저장·소비 형태.
- 본문이 아닌 레이어의 공개 상세 조립 골격.

## 참좋은여행 등 타 공급사

별도 본문 규칙·분기로 추가한다. 이 계약에 맞춘 로직을 공통 레이어에 합치지 않는다.
