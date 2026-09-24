# simplyur ASO — App Store / Play listing SSOT

**Source of truth:** [`listing.json`](./listing.json)  
**Verify:** `npm run verify:simplyur-aso-listing` (repo root)

Home-screen icon label stays **`simplyur`**. Store titles carry the Korea eSIM keyword.

## Limits (2026)

| Field | iOS | Play |
|-------|-----|------|
| Title | 30 | 30 |
| Subtitle / short | 30 (subtitle) | 80 (short desc) |
| Keywords | 100 (hidden) | — (use short + full desc) |
| Promo text | 170 (not indexed) | — |
| Description | 4000 (not indexed) | 4000 (**indexed**) |

## Paste order (operator)

### Google Play Console
1. Default language **English (United States)** ← `en-US`
2. Store listing → App name / Short description / Full description / What's new
3. Add translations: Japanese, Chinese (Simplified), Chinese (Traditional), Vietnamese
4. Graphics: `../play-icon-512.png`, `../play-feature-1024x500.png`
5. Category: Travel & Local · Contact + privacy from `listing.json`

### App Store Connect
1. Primary locale **English (U.S.)**
2. Name / Subtitle / Keywords / Promotional Text / Description / What's New
3. Add ja, zh-Hans, zh-Hant, vi
4. Keywords: paste `iosKeywords` **exactly** (commas, no spaces)
5. Category: Travel (+ Lifestyle secondary)

## Screenshot caption order (first 5)

Use `screenshotCaptions` from each locale in `listing.json` — first two slides sell “Korea eSIM for visitors” + “QR before you fly”.

## Do not

- Put “Korea eSIM” in the home-screen name (clutter under icon)
- Repeat title/subtitle tokens inside iOS keywords
- Claim Japan / multi-country eSIM in Phase 1
- Target Korea residents (bongsim is separate)
