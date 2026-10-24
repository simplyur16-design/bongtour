# Phase A Audit — Menu / Parser / Compare / Pipeline

- **Date:** 2026-10-24  
- **Branch:** `audit/menu-parser-compare-pipeline` (from latest main; no remote push)  
- **Scope:** Read-only. Code/data unchanged except this report + `docs/audit/2026-10-24/*` + `scripts/audit/*`.  
- **DB host (name only):** `aws-1-ap-northeast-2.pooler.supabase.com` — treated as **production** (Supabase pooler).  
- **Read-only guarantee:** All prod queries via `scripts/audit/read-only-prisma.ts` → `SET TRANSACTION READ ONLY` inside `$transaction`; findMany/count/SELECT only. No local Next against prod.

---

## 1) Summary

| Area | PASS | FAIL | SKIP | P0 | P1 | P2 |
|---|---:|---:|---:|---:|---:|---:|
| A1 Mega-menu | 6 | 2 | 3 | 0 | 3 | 3 |
| A2 Parsers | 16 | 1 | live×N | 0 | 1 | 2 |
| A3 Compare | 5 | 0 | 1 | 0 | 0 | 1 |
| A4 Pipeline | 3 | 0 | 3 | 0 | 3 | 2 |
| A5 Past work | — | — | — | 0 | 0 | 1 |
| A6 Baseline | 2 | 2 | 1 | 0 | 0 | 1 |

**Totals (findings below):** P0=0 · P1=7 · P2=10  

**Not run (safety):** all write/heal/backfill/live-gate scripts — see `2026-10-24/skipped-dangerous-and-live.md`.

---

## 2) Past work that looks correct (with evidence)

| Topic | Verdict | Evidence |
|---|---|---|
| Mega-menu leaf SSOT shared by desktop/mobile | 의도대로 됨 | `TopMegaMenu` / `MobileDrilldownMenu` import `MEGA_MENU_TAB_DEFINITIONS`; leaf export 225 |
| Register ↔ mega geo wiring (7 suppliers) | 의도대로 됨 | `verify:supplier-register-mega-menu-geo` OK |
| City leaf register alignment (static) | 의도대로 됨 | `verify:mega-menu-register-alignment` OK |
| Similar-itinerary cluster = mega leaves | 의도대로 됨 | vitest 24 pass; aliases 칭다오→청도, AU/NZ→호주/뉴질랜드; 일본/중국 bare → null |
| Compare entry no preset fallback | 의도대로 됨 | `page.tsx` empty copy when `!place\|\|!duration`; CTA only if `similarCompareHref` (`ProductLiveQuoteCard.tsx:316-324`) |
| Gap ingest admin-only | 의도대로 됨 | `enqueueCompareClusterGapIngestAction` → `requireAdmin` (code review only; not executed) |
| Fixture parsers hanatour ATP207 / modetour AVP603 | 의도대로 됨 | verify scripts OK |
| Supplier register SSOT freezes (7) | 의도대로 됨 | all PASS |
| Compare FREEZE ids present | 의도대로 됨 | `similar-itinerary-compare-cluster/entry`, `compare-cluster-supplier-gap-ingest`, `pending-compare-gap-priority` in manifest |
| India / Baltic / AU-NZ leaf work (90d commits) | 의도대로 됨 | git log + freeze markers; static verdics green |
| `card-price-exact-krw` freeze | 가드 있음 | manifest id present (price cross-check sample deferred — see PL-04) |

| Topic | Verdict | Evidence |
|---|---|---|
| Mega-menu node layout tests | 회귀됨 / 테스트 스톨 | `tests/mega-menu-panel-layout.test.ts`, `tests/mega-menu-south-america-tab.test.ts` FAIL (expected 8 tabs vs 9; southeast-asia scroll) |
| hotel-meal-display verify | 회귀됨 | `null !== 'A급1'` (`verify-hotel-meal-display.ts:150`) |
| Browse leaf product counts via HTML crawl | 부분 | HTTP 200 all; SSR shell has 0 `/products/` — card count inconclusive |
| Leaf browseSlug vs master `cityKey` | 부분 | e.g. leaf `phu-quoc` vs Product `phuquoc` → matrix false “0 tags” |
| lottetour/kyowontour parity | 미완 (계약 문서) | `supplier-api-public-detail-parity-contract.md` marks incomplete |
| kyowontour/naeiltour parse-contract docs | 경로 확인 필요 | no `docs/ops/*kyowon*` / `*naeil*` parse contracts found |

---

## 3) Findings

| ID | Area | Sev | Evidence | Expected | Actual | Cause (est.) | Fix proposal | Freeze guard candidate | Freeze conflict? |
|---|---|---|---|---|---|---|---|---|---|
| MM-01 | mega | P1 | `heal-candidate-counts.json` missingCityTag=10 | registered+cityKey ⇒ ≥1 ProductCityTag | 10 products missing tags | sync skipped / partial heal | DB: dry-run resync then apply after approval | `mega-menu-city-tag-required` | No (data) |
| MM-02 | mega | P1 | `mega-menu-db-matrix.json` zeroCityTagLeafCount=46; `leaf-slug-samples.json`; product `phuquoc` | leaf slug space ↔ master cityKey aligned | browse `phu-quoc` / `hcm` vs DB `phuquoc` | dual slug spaces | map via `resolveBrowseCityKeysForFilter` in audits; fix seed/card keys | `mega-menu-browse-slug-master-city` | touches mega-menu-* possibly |
| MM-03 | mega | P1 | matrix `missingCardCityCount=47` (미코노스, 아부다비, 나트랑, 호치민…) | MegaMenuGroupCardCity for menu cities | many UI cities absent on cards | seed lag | DB card seed / migration — not code in Phase B without approval | existing mega-menu-product-alignment | Yes if changing heal semantics |
| MM-04 | mega | P2 | `node --test tests/mega-menu-*.test.ts` FAIL | tests match current tabs/layout | south-america tab count 9≠8; SEA scroll flag | tests stale vs intentional UI | update tests **or** revert UI — needs product decision | panel-layout freeze? | Spec change |
| MM-05 | mega | P2 | `mega-menu-crawl.json` fail=0, zeroCardHints=60 | leaf GET 200 + cards>0 | 200 OK; cards not in SSR HTML | RSC/client list | crawl via browse API/JSON or Playwright; not HTML regex | n/a | No |
| MM-06 | mega | P2 | `mega-menu-leaf-set-diff.json` | desktop=mobile=landing leaf sets | sub-nav is region chips (3); landing uses different export | intentional IA | document SSOT ownership; optional landing leaf export | n/a | No |
| PS-01 | parser | P1 | `verify_hotel-meal-display.log` | hotel grade string `A급1` | `null` | display scrub / parser regress | fix display SSOT + golden | `hotel-meal-display` | may touch `public-hotel-display-scrub` |
| PS-02 | parser | P2 | path search | kyowontour/naeiltour parse contracts | **경로 확인 필요** | docs never added | add contracts or link body-parser docs | n/a | No |
| PS-03 | parser | P2 | package.json live-gate list | golden ≥2 samples / supplier | kyowontour·naeiltour fixtures thin; live skipped | scope | add fixtures under approval | *-register-ssot-freeze already | No |
| CP-01 | compare | P2 | `compare-cluster-vs-leaves.json` | 1:1 leaf keys | 222 cluster keys / 225 leaves (localDeparture tabs); AU cities→`australia` LC | by design | document AU/NZ LC absorption | `similar-itinerary-compare-cluster` | **Yes** if changing AU mapping |
| PL-01 | pipe | P1 | heal counts mongoliaOnChinaKey=4; sample `pkg-hn-0047` 내몽골/ordos/china | Mongolia vs Inner Mongolia distinct | china key for 내몽골 titles | geo haystack | DB rematerialize + register haystack rules | mega-menu-misc6 / compound-geo | possible |
| PL-02 | pipe | P1 | `pipeline-sample.json` `pkg-hn-0056` | Baltic registered ⇒ country/city tags | tags 0 / cityKey null | soft sync incomplete | RO rematerialize dry-run; then DB apply | mega-menu-product-alignment | data+maybe code |
| PL-03 | pipe | P1 | pipeline-sample many rows | tripNights/tripDays populated | null on most samples | fields unused; duration string only | confirm SSOT; fill on register or stop relying | register duration freeze? | TBD |
| PL-04 | pipe | P2 | A4 price triad | card = detail = compare KRW | not fully compared (SSR list empty; detail needs safe GET) | time/safety | RO script join ProductPrice + payload JSON | `card-price-exact-krw` | Yes if changing formula |
| PL-05 | pipe | P2 | parity contract | lottetour/kyowontour L1–L3 | contract says incomplete | backlog | keep section; no Phase B without scope | supplier-pipeline-alignment | No |
| A5-01 | past | P2 | freeze list 653 vs node mega tests fail | every correction frozen | layout tests outside vitest include | `tests/` not in vitest include | add staticGuard or move tests | mega-menu-panel-* | No |
| A6-01 | baseline | P2 | `freeze-ci.log` SEQP01 vitest | `:ci` green | **FAIL** `lib/modetour-schedule-africa-seqp01-image-keyword.test.ts` timed out 5000ms | known flaky/timeout class | raise testTimeout or speed keyword pass — **기존 실패 후보** | register-schedule-trip-image-keyword-dedupe | possible |

Out of scope listed only: eSIM `ComparePlansPopup` — not audited.

---

## 4) Matrices / tables (links)

| Artifact | Path |
|---|---|
| Leaf catalog (225) | [`2026-10-24/mega-menu-leaves.json`](./2026-10-24/mega-menu-leaves.json) |
| DB matrix + zero-tag leaves | [`2026-10-24/mega-menu-db-matrix.json`](./2026-10-24/mega-menu-db-matrix.json) |
| Heal-like counts | [`2026-10-24/heal-candidate-counts.json`](./2026-10-24/heal-candidate-counts.json) |
| Public GET crawl (60/225) | [`2026-10-24/mega-menu-crawl.json`](./2026-10-24/mega-menu-crawl.json) |
| Leaf-set notes | [`2026-10-24/mega-menu-leaf-set-diff.json`](./2026-10-24/mega-menu-leaf-set-diff.json) |
| Compare vs leaves | [`2026-10-24/compare-cluster-vs-leaves.json`](./2026-10-24/compare-cluster-vs-leaves.json) |
| Pipeline samples | [`2026-10-24/pipeline-sample.json`](./2026-10-24/pipeline-sample.json) |
| Pipeline highlights | [`2026-10-24/pipeline-trace-summary.json`](./2026-10-24/pipeline-trace-summary.json) |
| Cron role table | [`2026-10-24/cron-role-table.json`](./2026-10-24/cron-role-table.json) |
| Leaf slug samples | [`2026-10-24/leaf-slug-samples.json`](./2026-10-24/leaf-slug-samples.json) |
| Skipped scripts | [`2026-10-24/skipped-dangerous-and-live.md`](./2026-10-24/skipped-dangerous-and-live.md) |

### A1 crawl (sampled)

- Base: `https://bongtour.com`, concurrency 2, delay 350ms, GET only.  
- **failCount=0** (all HTTP 200, no redirect loops).  
- Card counts: **SKIP/inconclusive** (SSR HTML length ~55k, no `/products/` markers).

### A3 duration normalization (from vitest)

| Input | Normalized |
|---|---|
| `3박5일` | `3박 5일` |
| `3박  4일` | `3박 4일` |
| title hint `2박3일` | `2박 3일` |

---

## 5) Commands run

| Command | Result |
|---|---|
| `scripts/audit/check-script-writes.ts` on audit + verify targets | CLEAN / WRITE_RISK on product-alignment |
| `export-mega-menu-leaves` | PASS → 225 leaves |
| `read-only-mega-menu-db` | PASS |
| `read-only-pipeline-sample` | PASS |
| `read-only-heal-candidate-count` | PASS |
| `crawl-mega-menu-leaves-public` | PASS HTTP; card hints SKIP |
| `compare-mega-menu-leaf-sets` | PARTIAL |
| `compare-cluster-vs-leaves` | PASS |
| `verify:mega-menu-register-alignment` | PASS |
| `verify:supplier-register-mega-menu-geo` | PASS |
| `test:register-mega-menu-auto-classify` | PASS (9) |
| `vitest lib/mega-menu-*.test.ts` (+align/hub) | PASS (37) |
| `node --test tests/mega-menu-*.test.ts` (+related) | **FAIL** (layout/south-america) |
| `audit:geo-master-static` | **SKIP** (overwrites ops doc) |
| `verify:hanatour-atp207` / `verify:modetour-avp603` | PASS |
| `verify:*-lib` / `verify:*-register-ssot-freeze` (7) | PASS |
| `verify:modetour-register-title` / `verify:verygoodtour-title` | PASS |
| `verify:hotel-meal-display` | **FAIL** |
| `verify:suppliers-schedule-route-text-chain` | PASS |
| `verify:register-detail-final-chain` | PASS (static skip upsert) |
| `check:register-supplier-imports` | PASS |
| `vitest` register-parse / flight-modetour / lottetour / meal | PASS (27) |
| `vitest` similar-itinerary-compare* / gap* | PASS (24) |
| `verify:supplier-pipeline` (placeholder DATABASE_URL) | PASS static |
| `verify:regression-freeze:prebuild` | **PASS** |
| `verify:regression-freeze:ci` (placeholder `localhost:5432`) | **FAIL** — 기존 실패 후보: `modetour-schedule-africa-seqp01-image-keyword` vitest **5000ms timeout** (`freeze-ci.log`) |
| `npm run test:node` | **FAIL** — mega-menu panel/south-america + `schedule-image-keyword-empty-fallback` (`'' !== 'Osaka'`) |
| `npm test` | **SKIP** (time; freeze:ci already ran many vitest suites until SEQP01 timeout) |
| `npm run build` | **PASS** after clearing node locks (first attempt Prisma `EPERM`; retry OK — `build.log`) |

### Dangerous / live not run

See `2026-10-24/skipped-dangerous-and-live.md`.

---

## 6) Path checks

| Path (brief) | Status |
|---|---|
| `lib/mega-menu-regions.data.ts` etc. | OK |
| Parser contracts hanatour/modetour/ybtour/verygoodtour | OK under `docs/ops/` |
| `docs/body-parser-lottetour-ssot.md` | OK |
| kyowontour / naeiltour parse-contract | **경로 확인 필요** |
| `lib/register-<supplier>-price*` | partial — use register SSOT modules; do not invent paths |
| lottetour/kyowontour sweep modules | parity contract: incomplete; sweep via cron/API |

---

## 7) Approval ask (Phase B gate)

**Recommended fix order (code, after approval):**  
1. PS-01 hotel-meal-display  
2. MM-02 browseSlug↔cityKey mapping clarity (code+tests)  
3. PL-03 duration field SSOT (if product wants tripNights filled)  
4. MM-04 test update vs UI revert (needs product call)

**DB corrections (separate approval — do not run apply):**  
- MM-01 missing ProductCityTag (10)  
- MM-03 MegaMenuGroupCardCity gaps  
- PL-01 / PL-02 geo rematerialize (mongolia/china, baltic tags)

**REGRESSION-FREEZE collision risk:**  
- CP-01 / AU-NZ cluster (`similar-itinerary-compare-cluster`)  
- PL-04 price formulas (`card-price-exact-krw`)  
- MM-03 if changing heal behavior of `mega-menu-product-alignment`

---

## 8) Commit note

Phase A local commit contains **only** `docs/audit/**` and `scripts/audit/**`.
