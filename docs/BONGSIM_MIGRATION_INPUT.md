# BONGSIM Migration Input

Handoff for engineers starting the **standalone BONGSIM** repository. All paths are relative to the Bongtour monorepo root unless noted.

---

## What Exists Today in Bongtour

| Artifact | Path / detail |
|----------|----------------|
| Menu label + href | `components/top-nav/overseas-sub-nav-items.ts` — `label: 'E-sim'`, `href: '/travel/esim'` |
| Submenu rendering | `components/top-nav/OverseasSubNavLinksRow.tsx`, `OverseasSubNavHubRow.tsx`, `MobileDrilldownMenu.tsx` |
| 해외여행 sub bar | `app/components/travel/overseas/OverseasTravelSubMainNav.tsx` (`variant="links"` on E-SIM page) |
| Page | `app/travel/esim/page.tsx` |
| Client UI block | `app/components/travel/esim/EsimCityHub.tsx` |
| Static config | `lib/travel-esim-city-config.ts` — `ESIM_CITY_ENTRIES`, `EsimCityEntry`, `getEsimCityEntryBySlug` |
| Tab style tokens | `components/top-nav/overseas-sub-nav-styles.ts` |
| Global chrome | `app/components/Header.tsx`, root `app/layout.tsx` |
| Commerce / API / DB / admin for eSIM | **NOT FOUND** |

---

## What Can Be Reused

**Conceptually or by copy-paste of constants/strings (not npm package):**

- Visual parity targets listed in `docs/BONGSIM_UI_REFERENCE_FROM_BONGTOUR.md`
- `?city=` slug pattern as prior art only — redefine if BONGSIM catalog model differs
- Metadata shape in `app/travel/esim/page.tsx` (title, description, canonical, openGraph) as SEO checklist

**Do not reuse as a dependency:** Bongtour React components cannot be imported from another repo without extraction; treat files as **reference**.

---

## What Must Be Rebuilt From Scratch

- Product catalog (plans, coverage, validity, price)
- Cart / checkout / payment
- User accounts or SSO handoff from Bongtour (undefined today)
- Order persistence and admin
- Webhooks / supplier integration (**usimsa or other — not in Bongtour**)
- Legal, refund, privacy pages for eSIM retail
- Analytics events specific to funnel

---

## What To Ignore

- Placeholder strings inside `esimEmbedHtml` in `lib/travel-esim-city-config.ts`
- `dangerouslySetInnerHTML` embed approach for production commerce unless security-reviewed for a specific supplier widget
- Must-know / LLM helper files that mention SIM/유심/이심 but do not implement E-SIM (`lib/must-know-trip-readiness-filters.ts`, `app/components/travel/MustKnowEssentialsSection.tsx`, etc.)

---

## Recommended Initial Routes For BONGSIM **(proposed)**

| Route | Purpose |
|-------|---------|
| `/` | Marketing landing |
| `/plans` or `/destinations` | Browse by country/region |
| `/p/[skuSlug]` | Plan detail |
| `/checkout` | Checkout (auth gate TBD) |
| `/orders` | Order list |
| `/orders/[id]` | Order detail + QR / install |
| `/support` | Device help + FAQ |

Exact path prefix (`/app` vs locale) is BONGSIM framework choice.

---

## Recommended Initial Component List **(proposed)**

- `AppShell` (header/footer matching Bongtour tokens or Bongsim-branded variant)
- `PlanCard`, `PlanFilters`
- `PriceBlock`, `DataAmountBadge`, `ValidityBadge`
- `CheckoutStepper`, `PaymentFrameHost` (provider-specific)
- `OrderStatusBadge` (maps internal enum → Korean)
- `CompatibilityCallout` (pre-purchase)

---

## Recommended Initial Mock Data Shape **(proposed)**

Mirror **field names** inspired by current `EsimCityEntry` only where still useful; extend for commerce:

```ts
// Proposed shape — NOT an existing Bongtour export
type BongsimPlanMock = {
  skuSlug: string
  destinationLabelKo: string
  regionCodes: string[] // ISO 3166-1 alpha-2
  dataGb: number | null
  validityDays: number
  priceKrw: number
  highlightsKo: string[]
  compatibleOs: ('ios' | 'android')[]
}

type BongsimDestinationMock = {
  slug: string
  labelKo: string
  plans: BongsimPlanMock[]
}
```

Current Bongtour type **(verified)** — full definition in `lib/travel-esim-city-config.ts` (`EsimCityEntry`: `slug`, `label`, `esimEmbedHtml`, optional `esimScriptSrcs`).

---

## Adapter Slot For Future usimsa API **(proposed)**

**Status in Bongtour:** **NOT FOUND** — no `usimsa` string, client, or route.

**BONGSIM repo should add:**

- `lib/adapters/usimsa/` (or equivalent) with:
  - `UsimsaClient` interface (list plans, create order, fetch order status)
  - Env-driven base URL + API key **server-side only**
  - DTO mappers from usimsa JSON → `BongsimPlanMock` / internal order model
- Single **ingress** for webhooks (e.g. `app/api/webhooks/usimsa/route.ts` in BONGSIM Next app) with signature verification

Until the adapter exists, UI should consume **mock JSON** only.

---

## Recommended Build Order **(proposed)**

1. **Repo + design tokens** aligned to `docs/BONGSIM_UI_REFERENCE_FROM_BONGTOUR.md`
2. **Static catalog UI** from mock JSON (no payments)
3. **Plan detail + compatibility callout**
4. **Auth decision** (Bongtour session vs standalone account) — document in integration ADR
5. **Checkout + test PG**
6. **usimsa adapter** behind server actions or route handlers
7. **Orders + webhooks**
8. **Bongtour link swap** — change `overseas-sub-nav-items.ts` `href` or add redirect page (separate change ticket; do not block BONGSIM MVP)
