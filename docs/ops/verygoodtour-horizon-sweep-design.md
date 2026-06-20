# verygoodtour 180일 horizon sweep 설계

## 현재 상태 (2026-06-20)

| 항목 | 상태 |
|------|------|
| 등록 상품 | 17건 — **일부 stale ProCode** (`ops/verygood-e2e-debug/findings.json`); live 예: `EPP0113-260424SK` |
| 3h cron | Python E2E (`calendar_e2e_scraper_verygoodtour`) — TS sweep과 병행 |
| price-collect | `lib/verygoodtour-price-collect.ts` — HXR→E2E |
| sweep | `lib/verygoodtour-sweep.ts` + KST **08:00** cron |
| recheck-meta | `lib/verygoodtour-price-recheck-meta.ts` — 7일 |
| oneshot | `npm run db:verygoodtour-sweep-oneshot` |
| HXR coverage | `npm run db:verygoodtour-hxr-coverage` |
| URL inventory | `npm run verify:verygoodtour-url-health-inventory` |
| parity | `verify:supplier-api-public-detail-parity -- --supplier verygoodtour` |
| register-facts | `PackageDetail` SSR HTML (`lib/register-facts/verygoodtour.ts`) |

## HXR 실측

| 엔드포인트 | 형식 | 비고 |
|-----------|------|------|
| `GET /Product/PackageDetail?ProCode=&PriceSeq=1` | HTML | 등록·본문 SSOT |
| `GET /Product/ProductCalendarSearch?MasterCode=&Year=&Month=` | HTML fragment | plain GET — **우측 가격 행 0** |
| E2E live control | Playwright | 모달 클릭 후 우측 행 수집 |

**결론:** sweep은 HXR 우선 → **E2E subprocess 폴백** (`collectVerygoodtourPriceInputsWithE2eFallback`).

## 모듈 맵 (ybtour/lottetour 미러)

| 모듈 | 역할 |
|------|------|
| `verygoodtour-calendar-hxr.ts` | MasterCode·월별 ProductCalendarSearch 파싱 |
| `verygoodtour-detail-url-health.ts` | HEAD→GET 만료 가드·MenuCode 정규화 |
| `verygoodtour-price-collect.ts` | HXR → E2E |
| `verygoodtour-price-recheck-meta.ts` | rawMeta 7일 재확인 |
| `verygoodtour-sweep.ts` | 180일 sweep·horizonSoldOut prune |
| `run-verygoodtour-horizon-hxr-coverage.ts` | HXR 커버리지 probe |
| `run-verygoodtour-url-health-inventory.ts` | 등록 URL live/stale inventory |

## 식별키

- URL: `ProCode=XXX-YYMMDDCC`
- 달력: `MasterCode` = ProCode prefix
- sweep 힌트: `originUrl` / `originCode` (정규화 시 `MenuCode` 제거)

## env

- `VERYGOOD_ONESHOT_PAUSE_MS` (기본 2500)
- `VERYGOOD_HXR_COVERAGE_PAUSE_MS` (기본 800)
- `VERYGOOD_URL_PROBE_PAUSE_MS` (기본 400)
- `DISABLE_INSTRUMENTATION_VERYGOODTOUR_SWEEP_CRON=1`

## 선행 운영

1. `verify:verygoodtour-url-health-inventory` — stale URL 식별
2. live URL로 `originUrl` 갱신 (`--apply`)
3. `db:verygoodtour-hxr-coverage` — HXR 우측 0건 비율 확인
4. `db:verygoodtour-sweep-oneshot` — 전량 1회 sweep
