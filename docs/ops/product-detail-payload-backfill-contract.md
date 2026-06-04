# publicDetailPayloadJson backfill 계약

## ybtour slim (패키지 travel만)

- `listingKind === 'travel'` + `publicConsumptionModuleKey === 'ybtour'` + `variant === 'package'` 만 `ybtourDetailProduct` 히어로 항공 슬라이스로 축소.
- **`listingKind === 'air_hotel_free'` (자유여행)** 는 `variant === 'airtel'` — `viewProduct`·`priceRowsForPublic`·`masterArg` 전량 persist. slim 금지.

회귀: `lib/product-public-detail/product-public-detail-payload.test.ts` — `ybtour air_hotel_free payload`.

## backfill 전 백업 (필수)

1. 마이그레이션 적용: `20260603130000_product_public_detail_payload_backup` (`publicDetailPayloadJsonBackup` 컬럼).
2. `npm run db:backup-detail-payload` — 기존 payload가 있는 registered 상품만 1회 스냅샷(이미 backup 있으면 skip).
3. `npm run db:backfill-detail-payload` — `--after-backup` 플래그 내장(없으면 스크립트 거부).

## 배포 후 검증 (ybtour 자유여행)

```sql
SELECT slug,
  octet_length("publicDetailPayloadJson") AS bytes,
  (("publicDetailPayloadJson"::jsonb)->'model'->'viewProduct'->'itineraries') IS NOT NULL AS it,
  octet_length((("publicDetailPayloadJson"::jsonb)->'model'->'priceRowsForPublic')::text) AS prices_octet,
  octet_length((("publicDetailPayloadJson"::jsonb)->'model'->'masterArg')::text) AS master_octet
FROM "Product"
WHERE "originSource" = 'ybtour' AND "listingKind" = 'air_hotel_free';
```

기준: 4건 모두 `it=true`, `prices_octet > 100`, `master_octet > 100`.

## ybtour 패키지 다이어트 유지

```sql
SELECT count(*),
  pg_size_pretty(percentile_cont(0.5) WITHIN GROUP (ORDER BY octet_length("publicDetailPayloadJson"))::bigint) AS p50
FROM "Product"
WHERE "originSource" = 'ybtour' AND "listingKind" = 'travel';
```

기준: `p50` < 120 KB.
