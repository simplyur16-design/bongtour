# Handoff: Simply UR — My eSIM [06]

## Overview
**Signed-in** tab: order list → order detail (QR + data usage). 4th tab in the app, or entry from Home. Web equivalent already lives at `/my-esim`.

## About the Design Files
The files here are **design references built in HTML** (an internal prototyping format) showing the real look/spacing — not production code to copy directly. Recreate in the target codebase's actual stack (React Native / Next.js etc.) using its own conventions; don't embed or ship the HTML itself.

## Flow Position
```
Home / Tab bar → My eSIM (list) → Order detail → Data usage (modal)
                     ↑ sign-in / empty states gate the list
```

## States
| State | UI |
|---|---|
| Signed out | Lock glyph, "Sign in to see your eSIMs", Sign in CTA |
| No orders | Signal glyph, "No orders yet", Browse plans CTA |
| Order list | Title + cards (date, plan summary, status badge, chevron) |
| Order detail | Back link, status badge, plan title, QR panel, usage summary card |
| Usage modal | Bottom sheet over detail: total used, progress bar (capped plans only), 7-day bar chart |

## Order statuses
- **Active** — green badge `#E4F5EC` bg / `#1B8A56` text
- **Expired** — gray badge `#F0EEE9` bg / `#98A0AB` text
- **Upcoming** — blue badge `#EAF1FF` bg / `#2E5FD9` text

## Data usage logic (important)
Every order has a usage summary — shown both as a one-line label on the order-detail card, and expanded in the usage modal:
- **Unlimited plan**: no progress bar, just "{X GB} used today" — resets daily.
- **Capped plan**: mini progress bar on the summary card; modal shows full bar + explicit **used vs. remaining** (e.g. "12.1 GB used" / "2.9 GB left"), plus a 7-day bar chart of daily usage.
- **Upcoming / not yet activated**: "Not started", no bar, sublabel "Activates on first connection".

The order-detail usage card is tappable and opens the modal; modal has its own close (✕).

## Copy SSOT (English)
| Key | Copy |
|---|---|
| Sign-in title | `Sign in to see your eSIMs` |
| Sign-in body | `Track your orders, view QR codes, and check data usage once you're signed in.` |
| Sign-in CTA | `Sign in` |
| Empty title | `No orders yet` |
| Empty body | `When you buy a plan it'll show up here with your QR code and usage.` |
| Empty CTA | `Browse plans` |
| Back link | `Back to My eSIM` |
| QR hint | `Scan in Settings → Cellular → Add eSIM` |
| Usage card label | `Data usage` |
| Modal title | `Data usage` |
| Modal used/remaining | `{used} used` / `{remaining} left` |

Translate into ja / zh / zh-TW / vi preserving meaning; keep number/data-unit formatting locale-correct.

## Design Tokens (shared across all screens)
- Coral (CTA, links, progress fill): `#FF6B4A`
- Navy (titles): `#12233F`
- Muted text: `#6B7686` · Faint text: `#98A0AB`
- Card/border: `#E1DFD9` · Divider/track: `#F0EEE9`
- Page background: `#FFF4EF`
- Font: Poppins, weights 400/600/700/800
- Card radius: 16–18px · CTA radius: 16px · Modal sheet radius: 24px (top corners)

## Files
- `My eSIM Screen.dc.html` — reusable screen component. Props:
  - `view`: `signin` | `empty` | `list` | `detail`
  - `selectedOrderIndex` (number) — which sample order the detail/modal view shows
  - `usageModalOpen` (bool) — force the usage modal open (for review); in real use it's internal state toggled by tapping the usage card
  - `onLoginClick`, `onBackClick`, `onOrderClick(index)` — callbacks
  - Ships with 3 sample orders illustrating unlimited / capped-expired / upcoming
- `App - My eSIM.dc.html` — review canvas with all states + both usage-modal variants (unlimited vs. capped) in iPhone frames. Open in a browser to inspect.

## Out of Scope
- Plans picker, Product detail, Install guide (separate handoffs, already delivered)
- Checkout / payment flow
- Actual eSIM install / carrier integration
