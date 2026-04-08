# Detail Body Consumption Audit

This document records the current consumption path for detail-body structured outputs.

## Scope

- Structured pipeline only (`raw -> structured -> final`).
- Admin preview/edit and public detail rendering.
- Supplier price/calendar adapters are out of scope.

## Consumption Path Check (Hotel / Optional / Shopping)

### Admin Preview (`app/admin/register/page.tsx`)

- Preview reads `productDraft.detailBodyStructured`.
- Source explanation is shown per section (override input vs body auto extraction).
- Section row counts and review badges are rendered from detail-body structured output.

### Save (등록 API confirm — 4개 전용 + 잔여 fallback)

- 엔드포인트: `POST /api/travel/parse-and-register-modetour` · `…-verygoodtour` · `…-hanatour` · `…-ybtour`(레거시 `…-yellowballoon`) 및 잔여 `POST /api/travel/parse-and-register`. 모두 preview/confirm 계약으로 동일 계열 필드를 저장한다.
- Confirm path stores:
  - `rawMeta.structuredSignals.*` (canonical + diagnostics)
  - Product-level compatibility fields used by public/admin screens.
- `rawMeta` keeps structured diagnostics and section-level raw snapshots.

### Admin Edit (`app/admin/products/[id]/page.tsx`)

- Edit reads `rawMeta.structuredSignals` and visualizes:
  - raw present status
  - structured summary
  - review(required/warning/info)
  - flight status/exposure policy
  - public consumption mode per section (`canonical-first` / `legacy-fallback` / `none`)

### Public Detail (`app/products/[id]/page.tsx` and detail components)

- Optional tours:
  - Main rendering path consumes canonical `rawMeta.structuredSignals.optionalToursStructuredCanonical` (converted to public rows payload).
  - Fallback keeps `Product.optionalToursStructured` for compatibility.
- Shopping:
  - Main rendering path consumes canonical `rawMeta.structuredSignals.shoppingStructured.rows`.
  - Fallback keeps `Product.shoppingShopOptions` then `structuredSignals.shoppingStops`.
- Hotel:
  - Main rendering path consumes canonical `rawMeta.structuredSignals.hotelStructured.rows` (mapped to `DayHotelPlan[]`).
  - Fallback keeps `structuredSignals.dayHotelPlans`, then schedule/hotel summary parsing.

## E2E Operation Flow Check (Code-path audit)

Representative flow was traced in code for sample-like scenarios:

1. Raw input (plus optional section overrides) is submitted in register UI.
2. Preview shows section source and structured/review summary.
3. Confirm persists both structured signals and public compatibility fields.
4. Edit shows structured diagnostics from `rawMeta`.
5. Public detail consumes conservative fields and avoids internal diagnostics.

## Consistency Findings

- No breaking mismatch found in current save/read path.
- Canonical-first path is now applied for hotel/optional/shopping.
- Compatibility fallback paths remain and are explicitly marked temporary.

## SSOT References

- `docs/detail-body-review-policy.md`
- `docs/detail-body-input-priority.md`
- `docs/detail-body-public-consumption-policy.md`

## Operational Aggregation

- Run `scripts/report-public-consumption-observability.ts` for recent-50 aggregation.
- Use this output to monitor:
  - section-level canonical/fallback ratios
  - supplier-level fallback distribution
  - preview/public row-diff frequency

Always align policy changes with these documents before code updates.
