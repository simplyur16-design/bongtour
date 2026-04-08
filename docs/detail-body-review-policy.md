# Detail Body Review Policy

This document fixes review criteria for the structured detail-body pipeline.

## Severity Definitions

- `required`
  - Public misinformation risk is high.
  - Examples: section split failure, flight failure status, include/exclude split failure.
- `warning`
  - Structure exists but key fields are missing/partial.
  - Examples: partial flight, missing flight numbers, hotel candidate ambiguity.
- `info`
  - Informational state, no direct misinformation risk.
  - Examples: optional tours absent, shopping absent.

## Gemini Repair Trigger Policy

- `always`
  - Section exists but rows are zero in core table sections.
  - Flight review failure status.
- `conditional`
  - Rows exist but quality score is low.
  - Flight quality low or core fields missing.
- `skip`
  - Structured output is stable and sufficiently complete.

## Flight Status Relationship

- `success`
  - Outbound and inbound core fields are sufficiently present.
  - Typically mapped to `public_full`.
- `partial`
  - One/both legs exist but key fields are incomplete.
  - Mapped to `public_limited`.
- `failure`
  - Candidate evidence is insufficient for safe public rendering.
  - Mapped to `admin_only`.

## ExposurePolicy Relationship

- `public_full`
  - Full public rendering allowed.
- `public_limited`
  - Render only existing fields with a short assistive note.
- `admin_only`
  - No public leg rendering; admin review remains the source of diagnostics.

## Operational Rule

- Do not lower pollution guards to improve recall.
- Keep review semantics stable across parser refactors.
