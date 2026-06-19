# modetour SD1 inventory — airtel(`fit-mt-*`) 정책

## 배경

`npm run verify:modetour-sd1-inventory`는 등록 modetour 상품에 대해 B2C API `GetOtherDepartureDates`를 호출해 **SD1**(상품 없음) / **SD2** / **ok**를 분류한다.

실측(limit 30): **ok 10 · sd1 19 · sd2 1** — SD1 중 **18건**은 DB에 priced `ProductDeparture`가 잔존한다.

## 자동 조치 (sweep)

| listingKind | productType | SD1+0건 시 |
|-------------|-------------|-----------|
| `travel` (패키지) | `travel` | `auto_unpublished` + 지평 내 출발 prune |
| `air_hotel_free` | `air-hotel` | **skip** — `isModetourSd1AutoUnpublishEligible` = false |
| airtel | `airtel` | **skip** |

근거: `lib/modetour-sd1-policy.ts` — 자유여행·에어텔은 E2E/API 단일 실패만으로 unpublish 하지 않는다.

## 운영 playbook (SD1 + DB 잔존)

1. `npm run verify:modetour-sd1-inventory` → `ops/modetour-sd1-inventory.json`
2. `status=sd1` + `dbDepartureCount > 0` slug 목록 추출
3. live 상세 URL·productNo 재확인 (형제 productNo / originUrl refresh)
4. 확실한 판매종료만:
   - 수동 `registrationStatus` 조정, 또는
   - `scripts/ops-republish-modetour-sd1-with-future-deps.ts --apply` (false-positive SD1 unpublish 복구용)
5. airtel은 **priceFrom backfill** 경로로 parity L3 false positive 가능 — L1(API 0 vs DB)과 분리 검토

## 회귀

- `REGRESSION-FREEZE[modetour-sd1-inventory]` — `scripts/run-modetour-sd1-inventory.ts`
