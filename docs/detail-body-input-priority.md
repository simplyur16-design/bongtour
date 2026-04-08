# Detail Body Input Priority

This document fixes input priority and usage boundaries for admin operations.

## Input Priority

1. Full pasted body (`본문 전체 원문`)
   - Baseline source for automatic extraction.
2. Section table pastes (optional override)
   - Hotel / Optional Tour / Shopping section pastes are optional override inputs.
3. No input
   - Empty structured result is allowed; review badges explain gaps.

## Why Preview Shows Source

Preview is not just output listing.  
It explains final source decisions per section:

- override input applied
- body auto extraction applied
- no source available

This reduces operator ambiguity before save.

## raw / structured / final Relationship

- `raw`
  - Original pasted content, preserved for re-parse.
- `structured`
  - Parser-normalized object result.
- `final`
  - Public/admin consumption result based on structured + exposure policy.

## Editing Policy

- Default path: edit raw -> re-parse -> regenerate structured.
- Direct structured manual editing is not the default operating path.

## Admin vs Public Display

- Admin
  - Shows richer diagnostics (review reasons, flight status, exposure policy).
- Public
  - Conservative rendering according to exposure policy only.

## Stability Rule

- Keep this priority fixed unless explicit policy change is approved.
