# Handoff: Simply UR — Home tab

## Overview
Bottom tab **Home** — the landing screen after Login (or Skip). Korea eSIM value proposition + **Find my eSIM** CTA into Plans.

## About the Design Files
The files here are **design references built in HTML** (an internal prototyping format) showing the real look/spacing — not production code to copy directly. Recreate in the target codebase's actual stack (React Native / Next.js etc.) using its own conventions; don't embed or ship the HTML itself.

## Fidelity
High-fidelity. Same token system as Login 1b / Plans / Guide.

## Flow Position
```
[01 Opening] → [02 Login 1b] → ★ [03 Home] → [04 Plans] → [05 Product] → [06 Checkout] (not open yet)
                                      ↓                ↓
                              Install guide tab   Compatible devices (link out)
```

## Layout (top → bottom)
**Frame:** iPhone, 390×844, vertical scroll, background `#FFF4EF`, clears the 3-tab bar (Home · Find my eSIM · Install guide).

1. **Country pill** — `South Korea`, same navy `#12233F` pill component as Plans (white text, uppercase via CSS, radius 999px).
2. **Hero** — two lines, 34px/800, line-height 1.15: `Stay connected in` (navy `#12233F`) / `South Korea` (coral `#FF6B4A`).
3. **Subtext** — 14px `#6B7686`: "Get your QR code by email right after purchase. Install it before you fly, then activate the moment you land."
4. **Primary CTA** — `Find my eSIM`, full width, 56px, radius 16px, coral fill, white text, soft coral shadow — identical treatment to Opening's "Get Started" button. Taps through to the Plans tab.
5. **Phase banner** — same coral-tint info banner as Plans/Guide: "Checkout opening soon — You can browse plans and read the install guide now. Online payment is being enabled."
6. **Why simplyUR** — section label + 3 stacked cards (white, `1px solid #E1DFD9` border, radius 16px, 36px icon tile with peach `#FDEDE7` bg + coral glyph):
   - **Instant activation** — "No physical SIM, no store visit — install from your QR code in minutes."
   - **English support** — "Get help in plain English whenever you need it, before or during your trip."
   - **Easy refunds** — "Change of plans? Unused eSIMs are refundable — no hassle."
7. **Secondary links** — `Install guide →` and `Compatible devices →`, 13px/600, coral, no underline. First links to the Guide tab; second links to a compatible-devices list page (out of scope here — link only).
8. **Bottom tab bar** — Home / Find my eSIM / Install guide, Home active (coral icon + bold label), sticky bottom, white bg, `1px solid #EAE8E2` top border.

## Copy SSOT (English)
| Key | Copy |
|---|---|
| Country pill | `South Korea` |
| Hero line 1 | `Stay connected in` |
| Hero line 2 | `South Korea` |
| Subtext | `Get your QR code by email right after purchase. Install it before you fly, then activate the moment you land.` |
| CTA | `Find my eSIM` |
| Phase banner title | `Checkout opening soon` |
| Phase banner body | `You can browse plans and read the install guide now. Online payment is being enabled.` |
| Section label | `Why simplyUR` |
| Card 1 | `Instant activation` — `No physical SIM, no store visit — install from your QR code in minutes.` |
| Card 2 | `English support` — `Get help in plain English whenever you need it, before or during your trip.` |
| Card 3 | `Easy refunds` — `Change of plans? Unused eSIMs are refundable — no hassle.` |
| Link 1 | `Install guide →` |
| Link 2 | `Compatible devices →` |

Translate into ja / zh / zh-TW / vi preserving this meaning. Do not introduce supplier/carrier names or city names — this brand is Korea-wide, not city-specific.

## Design Tokens (shared across all screens)
- Coral (CTA, links, active tab, accents): `#FF6B4A`
- Navy (headline, pill fill, titles): `#12233F`
- Muted text: `#6B7686`
- Faint text: `#98A0AB`
- Card/border: `#E1DFD9`
- Icon tile bg / note fill: `#FDEDE7` (border `#FBD9CB` for banners)
- Page background: `#FFF4EF`
- Font: Poppins, weights 400/600/700/800
- Card radius: 16px · CTA radius: 16px · Pill radius: 999px

## States
| State | UI |
|---|---|
| Default | Static content, no loading state — Home has no API-dependent content |
| CTA tap | Navigate to Plans tab |
| Link tap | "Install guide" → Guide tab; "Compatible devices" → out-of-scope list page |

## Files
- `Home Screen.dc.html` — the reusable screen component. Props: `onFindEsim`, `onGuideClick`, `onDevicesClick` (all callbacks, wire to your router).
- `App - Home.dc.html` — review canvas mounting it in an iPhone frame with a component spec panel. Open in a browser to inspect.

## Out of Scope
- Plans / Product / Guide redesign (separate handoffs, already delivered)
- My eSIM, Checkout/payment
- Full compatible-devices list page (link out only)
