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
5. `db:verygoodtour-sweep-expired-cleanup` — inventory `expired=true` horizonSoldOut prune
6. `db:verygoodtour-hxr-e2e-cross-verify` — HXR·E2E 교차 검증 리포트

## Python 3h cron vs TS 08:00 sweep (역할 분리)

| 러너 | 주기 | SSOT | 역할 |
|------|------|------|------|
| `calendar_price_scheduler.py` → `calendar_e2e_scraper_verygoodtour` | **3시간** | Python Playwright | 레거시 달력 E2E — 등록 직후·수동 rescrape·HXR 0건 상품 **보조** 갱신 |
| `instrumentation-verygoodtour-sweep-cron.ts` | **KST 08:00** | `lib/verygoodtour-sweep.ts` | 등록 전량 **180일 Rule A** — HXR→E2E·7일 recheck-meta·horizonSoldOut prune·urgentDeal |

**원칙:** TS sweep이 가격·출발 SSOT. Python 3h는 sweep 미실행 구간·rescrape 폴백용으로 유지하되, 동일 상품에 **고속 연속** 이중 upsert 하지 않는다 (`lastSalesPolicyCheckedAt`·recheck-meta로 TS가 당일 처리한 상품은 Python 쪽에서 skip 권장 — scheduler 쪽은 별도 정리 대상).

**운영 순서:** URL inventory `--apply` → expired cleanup → oneshot 1회 → 이후 TS cron만으로 일1회 유지. Python 3h는 `DISABLE_INSTRUMENTATION_VERYGOODTOUR_SWEEP_CRON=1`이 **아닐 때** 병행.

## 교원이지(kyowontour) 참고 probe

사용자 제공 live URL 3건 — `ops/kyowontour-horizon-probe.json`. AJAX `POST /goods/differentDepartDate` 수집은 `lib/kyowontour-departures.ts` 기존 모듈. sweep 골격은 **미구현** — probe만:

```bash
npx tsx scripts/run-kyowontour-horizon-probe.ts
```

