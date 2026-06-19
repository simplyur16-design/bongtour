# verygoodtour 180일 horizon sweep 설계

## 현재 상태

| 항목 | 상태 |
|------|------|
| 등록 상품 | 17건 — **전부 stale URL(404/판매종료)** (`ops/verygood-e2e-debug/findings.json`) |
| 3h cron | Python E2E (`calendar_e2e_scraper_verygoodtour`) |
| API sweep | **없음** |
| price-collect / sweep | **없음** |
| register-facts | `PackageDetail` SSR HTML (`lib/register-facts/verygoodtour.ts`) |

## HXR 실측

| 엔드포인트 | 형식 | 비고 |
|-----------|------|------|
| `GET /Product/PackageDetail?ProCode=&PriceSeq=1` | HTML | 등록·본문 SSOT, meta `product:price:amount` |
| `GET /Product/ProductCalendarSearch?MasterCode=&Year=&Month=` | HTML fragment | 달력 좌측 일자만 plain GET — **우측 가격 행 0** |
| E2E live control | Playwright | 모달 클릭 후 우측 행 80건 (IPP105) |

**결론:** ybtour/lottetour처럼 단순 GET만으로는 부족. **ProductCalendarSearch + 모달 시퀀스 DOM** 또는 E2E subprocess 폴백 필요.

## ybtour 패턴 미러 (목표)

| 모듈 | verygoodtour |
|------|--------------|
| `verygoodtour-calendar-hxr.ts` | MasterCode·월별 ProductCalendarSearch + 우측 행 파싱 |
| `verygoodtour-price-collect.ts` | HXR 우선 → Python E2E 폴백 |
| `verygoodtour-price-recheck-meta.ts` | rawMeta 7일 재확인 |
| `verygoodtour-sweep.ts` | 180일 sweep |
| `run-verygoodtour-horizon-hxr-coverage.ts` | live probe (재등록 URL 확보 후) |

## 식별키

- URL: `ProCode=XXX-YYMMDDCC` (출발팀 코드)
- 달력: `MasterCode` = ProCode prefix (예 `IPP105`)
- sweep 힌트: `originUrl` / `originCode` / rawMeta

## HXR 파서 (foundation — `lib/verygoodtour-calendar-hxr.ts`)

| 함수 | 역할 |
|------|------|
| `buildVerygoodProductCalendarSearchUrl` | MasterCode·Year·Month GET URL |
| `parseVerygoodCalendarLeftCells` | `.dep_left_wrap` `td.jq_cl_day` → date·approxPrice |
| `parseVerygoodCalendarRightRows` | `.dep_right_wrap` `li.jq_cl_detailViewBtn` → adultPrice·ProCode·carrier |
| `parseVerygoodModalDomHtml` | 모달 HTML 통째 파싱 + `warnings` (right_rows_empty 등) |
| `parseVerygoodProCodeMasterCode` | `IPP105-2606243N5D` → `IPP105` |

**계약:** E2E `VERYGOOD_MODAL_DOM_BUNDLE_JS`와 동일. plain `ProductCalendarSearch` GET은 좌측만 — 우측은 모달 DOM 또는 E2E 폴백.

**회귀:** `REGRESSION-FREEZE[verygoodtour-hxr-calendar-parse]` · `lib/verygoodtour-calendar-hxr.test.ts`

## 선행 작업 (parity 전)

1. **운영:** stale 17건 ProCode 갱신 또는 재등록 (live URL 1건+: IPP105 등)
2. ~~**HXR:** ProductCalendarSearch HTML 파서~~ → foundation 완료; 다음: `verygoodtour-price-collect.ts` + E2E 폴백
3. **가드:** sweep 전 `isVerygoodtourDetailUrlExpired` (이미 manifest)
4. **parity:** `verify:supplier-api-public-detail-parity` verygoodtour tier 추가

## 공개 상세 소비 (기존)

- `build-render-model.ts` → `priceRowsVerygoodtour`
- 패키지: 출발 행 성인가 SSOT
- airtel: 본문 `productPriceTable` SSOT + `backfillVerygoodAirtelPublicPriceRows`

API sweep은 **패키지 listing**부터. airtel은 본문 표 병행 유지.

## env

- `VERYGOOD_ONESHOT_PAUSE_MS` (기본 2500)
- `VERYGOOD_SKIP_EVCD_PRICE_ENRICH` — 해당 없음
- `DISABLE_INSTRUMENTATION_VERYGOOD_SWEEP_CRON=1`
