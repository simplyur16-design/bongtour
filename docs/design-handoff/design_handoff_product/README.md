# Handoff: Simply UR — Product detail [05]

## Overview
Entered from **Plans** after tapping Select on a day-length. Shows the chosen plan summary (network / duration / data) + purchase CTA.

## About the Design Files
The files here are **design references built in HTML** (an internal prototyping format) showing the real look/spacing — not production code to copy directly. Recreate in the target codebase's actual stack (React Native / Next.js etc.) using its own conventions; don't embed or ship the HTML itself.

## Flow Position
```
Plans (day picker) → ★ Product → Checkout (disabled for now)
```

## Fidelity
High-fidelity. Continues Plans' card/token system. Background `#FFF4EF`.

## Layout (top → bottom)
1. **Back link** — `← Back to plans`, coral, 13px/600.
2. **Title** — `plan_summary`, e.g. "Korea 7-day Unlimited Roaming", 24px/800, navy.
3. **Price** — large, 34px/800, coral `#FF6B4A`.
4. **Detail panel** — white card, radius 18px, border `#E1DFD9`, 3 rows separated by hairline dividers `#F0EEE9`:
   - Network: Roaming / Local
   - Duration: {N} days (already chosen in picker — this is confirmation only)
   - Data: {data_label}
5. **CTA** — two variants:
   - **Current (checkout not open):** disabled button, gray fill `#E1DFD9`, text `Checkout opening soon`, plus a hint line below: "We'll email you the moment online payment goes live."
   - **Future (checkout open):** coral fill, white text, `Buy now`, same 56px/16px-radius treatment as other primary CTAs.

## States
| State | UI |
|---|---|
| Loading | Skeleton blocks for title, price, detail panel, CTA |
| Loaded | Full content as above |
| Not found | Dashed-border card, magnifier glyph, "Plan not found" + explanation + back link |
| Checkout disabled | Current default — see CTA above |
| Checkout enabled | Future state — swap in once payments ship |

## Copy SSOT (English)
| Key | Copy |
|---|---|
| Back link | `Back to plans` |
| Title pattern | `Korea {N}-day {data_label} {network}` |
| CTA disabled | `Checkout opening soon` |
| CTA disabled hint | `We'll email you the moment online payment goes live.` |
| CTA enabled | `Buy now` |
| Not found title | `Plan not found` |
| Not found body | `This plan may no longer be available. Head back and pick another trip length.` |
| Not found link | `Back to plans` |

Translate into ja / zh / zh-TW / vi preserving meaning; keep number/currency formatting locale-correct.

## Design Tokens (shared across all screens)
- Coral (CTA, price, links): `#FF6B4A`
- Navy (titles): `#12233F`
- Muted text: `#6B7686` · Faint text: `#98A0AB`
- Card/border: `#E1DFD9` · Divider: `#F0EEE9`
- Disabled fill: `#E1DFD9` on `#98A0AB` text
- Page background: `#FFF4EF`
- Font: Poppins, weights 400/600/700/800
- Card radius: 18px · CTA radius: 16px

## Files
- `Product Screen.dc.html` — reusable screen component. Props: `state` (`loaded`/`loading`/`not_found`), `network`, `days`, `dataLabel`, `price` (number, KRW), `checkoutEnabled` (bool), `onBackClick` (callback).
- `App - Product.dc.html` — review canvas with all 4 state variants in iPhone frames + component spec panel. Open in a browser to inspect.

## Out of Scope
- Plans picker, Install guide (separate handoffs, already delivered)
- Checkout / payment flow itself
- My eSIM
