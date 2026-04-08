# Flight Exposure QA Samples

Use this table when browser-based UI QA is available.

| Type | Sample ID | Supplier | Expected status | Expected exposurePolicy | Primary check point |
|---|---|---|---|---|---|
| success | M1 | 모두투어 | success | public_full | Airline + outbound + inbound all visible |
| success | Y1 | 노랑풍선 | success | public_full | Full rows, mobile wraps naturally |
| partial | H2 | 하나투어 | partial | public_limited | Partial leg fields + short assistive note |
| partial | C2 | 참좋은여행 | partial | public_limited | Missing fields hidden (no placeholders) |
| admin_only | Y3 | 노랑풍선 | failure | admin_only | No leg rows, only neutral fallback sentence |
| admin_only | C3 | 참좋은여행 | failure | admin_only | Same tone as regular info, not warning-heavy |

## QA Checklist Per Sample

- Mobile line wrapping: no awkward 4+ line breaks in one leg.
- Visual hierarchy: `가는편/오는편` content looks secondary to price but primary within core info.
- Partial overconfidence: no "complete itinerary" impression when fields are missing.
- Admin-only tone: neutral guidance, not alarming, no trust drop.
- Emphasis balance: flight block should not visually overpower other core info rows.
