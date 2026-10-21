# 항공사 사실 필드 계약 (supplier-product-fact-ssot)

등급·점수 없음. **항공사 표시명 1줄** 또는 `정보 없음`.

## 도출 (`deriveAirlineFact`)

1. 출발행 `ProductDeparture.carrierName` (가장 이른 출발일부터)
2. `rawMeta.structuredSignals.airlineName` (등록 파서 구조화)
3. 표시는 [`formatPublicAirlineDisplay`](../../lib/airline-iata-public-display-ssot.ts) — IATA→한글 (공개 히어로와 동일)

비교 체크리스트·공개 히어로는 동일 SSOT. 우열/추천 문구 없음.

## verify

`lib/supplier-product-fact-ssot.test.ts` · freeze id `supplier-product-fact-ssot`
