# Detail Body Public Consumption Policy

This document defines the public-detail consumption SSOT for detail-body structured outputs.

## Scope

- Public detail rendering (`/products/[id]` and detail components)
- Admin preview/edit consistency checks (source and review visibility)
- No supplier price/calendar adapter changes

## Flight Policy (Status + Exposure)

- `success` -> `public_full`
  - Airline / outbound / inbound fields can be fully rendered.
- `partial` -> `public_limited`
  - Render only existing fields. Do not invent placeholders.
  - Show short assistive message only when needed.
- `failure` -> `admin_only`
  - No public leg rendering.
  - Admin screen remains the diagnostic surface.

## Canonical-First Public Consumption

Public path should consume canonical structured fields first:

- Hotel: `structuredSignals.hotelStructured`
- Optional tours: `structuredSignals.optionalToursStructuredCanonical`
- Shopping: `structuredSignals.shoppingStructured`

## Canonical Mapping (Current)

- Hotel
  - Canonical `hotelStructured.rows` -> `DayHotelPlan[]` for hotel tab rendering.
- Optional tours
  - Canonical `optionalToursStructuredCanonical.rows` -> public optional rows payload.
- Shopping
  - Canonical `shoppingStructured.rows` -> `ShoppingStopRow[]`.

## Temporary Legacy Fallbacks

Fallbacks are still kept for compatibility and should be treated as temporary:

- Optional tours fallback:
  - `Product.optionalToursStructured`
- Shopping fallback:
  - `Product.shoppingShopOptions`
  - `structuredSignals.shoppingStops`
- Hotel fallback:
  - `structuredSignals.dayHotelPlans`
  - schedule hotel text / summary text parsing fallback

## Fallback Hit Observability

Per-product transition state is visible in admin edit diagnostics:

- `canonical-first`
- `legacy-fallback`
- `none`

Sections:

- Hotel
- Optional tours
- Shopping

This allows operations to identify which products still depend on fallback before canonical-only switch.

### Recent-50 Observation Method

Run:

- `npm -s exec tsx scripts/report-public-consumption-observability.ts`

This script reports:

- section-level canonical-first / legacy-fallback ratio
- supplier-level fallback hit distribution
- preview/public row-diff frequency (`any diff`, `abs diff > 1`)

Aggregation window is the latest 50 products by `createdAt`.

## Fallback Removal Criteria

Fallback removal can proceed when all are true:

1. Canonical rows are stably populated in regression samples.
2. Preview row counts and public row counts remain aligned for representative samples.
3. Admin edit structured summary and public rendering are logically consistent.
4. No increase in pollution or major row-loss after fallback disable dry-run.

## Quantitative Gate (Canonical-Only Readiness)

Use these numeric gates before removing fallback paths:

- Canonical hit ratio
  - Recent 50 registered products 기준
  - 호텔/선택관광/쇼핑 각각 `canonical-first` 비율 >= 90%
- Preview/Public row alignment
  - 동일 샘플군에서 preview row와 public row 차이:
    - 섹션별 절대 차이 <= 1
    - 또는 상대 오차 <= 10%
- Pollution stability
  - 연속 14일 동안 오염 재유입 0건
- Fallback hit ratio
  - 최근 50건에서 섹션별 `legacy-fallback` 비율 <= 10%
- Regression stability
  - `scripts/verify-detail-body-parser-regression.ts` 및
    `scripts/verify-public-consumption-priority.ts` 모두 통과

If one gate fails, keep fallback and continue canonical quality/coverage improvement.

## Legacy Removal Order (Fixed)

Remove fallback paths in this order:

1. `legacy_optional_tours_structured`
2. `legacy_shopping_db` / `legacy_shopping_meta`
3. `legacy_day_hotel_plans` / `legacy_hotel_narrative`

### 1) Remove `legacy_optional_tours_structured`

- Preconditions
  - Optional canonical-first ratio >= 90% (recent 50)
  - Optional fallback ratio <= 10%
- Check metrics
  - Optional preview/public `abs diff > 1` <= 10%
  - Optional pollution reintroduction = 0
- Post-removal verification
  - `scripts/verify-public-consumption-priority.ts`
  - `scripts/verify-detail-body-parser-regression.ts`
  - manual spot-check 2~3 products in admin/public

### 2) Remove `legacy_shopping_db` / `legacy_shopping_meta`

- Preconditions
  - Shopping canonical-first ratio >= 90%
  - Shopping fallback ratio <= 10%
- Check metrics
  - Shopping preview/public `abs diff > 1` <= 10%
  - No long-refund narrative pollution in rows
- Post-removal verification
  - same scripts + shopping-focused sample check

### 3) Remove `legacy_day_hotel_plans` / `legacy_hotel_narrative`

- Preconditions
  - Hotel canonical-first ratio >= 90%
  - Hotel fallback ratio <= 10%
- Check metrics
  - Hotel preview/public `abs diff > 1` <= 10%
  - Narrative-only fallback dependency is near zero
- Post-removal verification
  - same scripts + hotel/day-plan visual check

## Post-Removal Regression Checklist

- `scripts/verify-detail-parser-fixtures.ts` pass
- `scripts/verify-detail-body-parser-regression.ts` pass
- `scripts/verify-public-consumption-priority.ts` pass
- `scripts/report-public-consumption-observability.ts` confirms target ratios

## Operational Note

- Keep `raw -> structured -> final` boundary.
- Do not open direct structured manual editing as default operation.
