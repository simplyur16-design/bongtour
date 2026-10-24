# Phase A — 실행하지 않은 스크립트

## 운영 DB 쓰기 위험 (0-2)

| 스크립트/명령 | 이유 |
|---|---|
| `verify:mega-menu-product-alignment` | `prisma.product.update` + `syncProductGeoTags` heal |
| `resync:mega-menu-geo:apply` / `--apply` | DB 반영 |
| `apply:mega-menu-geo-corrections(:apply)` | 쓰기 |
| `backfill:*`, `db:*` (sweep/sync/backfill/push/seed), `seed:*` | 쓰기 |
| `cleanup:*`, `products:purge-*`, `booking:*`, `gc:*`, `migrate:*`, `heal:*` | 쓰기 |
| `season-curation:force`, `calendar:*`, `cron:daemon` | 부작용 |
| `prisma db push` / `migrate` | 스키마 변경 |

## dry-run만 허용 여부 (코드 확인)

- `scripts/resync-all-mega-menu-geo.ts`: `--apply` 없으면 dry-run. Phase A에서는 **미실행**(같은 파일에 update 경로 존재).

## 공급사 live 호출 (미실행 · 목록만)

- `verify:register-facts-live`
- `verify:register-facts-detail-parity`
- `verify:register-*-live-gate` (hanatour/modetour/ybtour/lottetour/kyowontour/verygoodtour/naeiltour/six-suppliers 등)

## 기타 SKIP

| 항목 | 이유 |
|---|---|
| `npm run audit:geo-master-static` | `docs/ops/phase1-geo-master-seed-gap-report.md` 덮어씀 |
| `verify:mega-menu-browse` / `audit:mega-menu-geo` / diagnose-browse-pool-gap (원본) | 운영 DB 직접 실행 금지 → RO 대체로 heal 건수만 집계 |
| 로컬 Next + 운영 DB | instrumentation cron + `publicDetailPayloadJson` update |
| Gemini/LLM · 이미지 업로드 · 알림톡 | Phase A 범위 밖 |
