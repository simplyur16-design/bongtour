# Bongtour Current E-SIM Audit Final

Technical record of the E-SIM surface **as implemented in this repository** at documentation time. Scope: menu, route, page, components, data, backend traces, reusable vs disposable assets.

---

## Current Menu Structure

| Item | Value |
|------|--------|
| **Primary menu data** | `components/top-nav/overseas-sub-nav-items.ts` — constant `OVERSEAS_SUB_NAV_ITEMS` |
| **E-SIM entry** | `{ kind: 'link', href: '/travel/esim', label: 'E-sim' }` |
| **Consumers of same array** | `components/top-nav/OverseasSubNavLinksRow.tsx`, `components/top-nav/OverseasSubNavHubRow.tsx`, `components/top-nav/MobileDrilldownMenu.tsx` |
| **해외여행 sub bar wrapper** | `app/components/travel/overseas/OverseasTravelSubMainNav.tsx` — `variant="links"` renders `OverseasSubNavLinksRow` / `OverseasSubNavMobileScrollRow` inside `SITE_CONTENT_CLASS` |
| **Global header (1차)** | `app/components/Header.tsx` — `MAIN_NAV` includes `해외여행` → `/travel/overseas` only; **E-SIM direct link in MAIN_NAV: NOT FOUND** |
| **Conditional hide for E-SIM only** | **NOT FOUND** (item is always included when the overseas sub-nav list is rendered) |
| **Active-state helper** | `components/top-nav/overseas-sub-nav-styles.ts` — `isOverseasSubNavHrefActive`, `hrefForOverseasSubNavItem` |

---

## Current Route/Page Structure

| Item | Value |
|------|--------|
| **Public path** | `/travel/esim` |
| **City selection (query)** | `?city=<slug>` — e.g. `tokyo`, `osaka`, `bangkok` per `lib/travel-esim-city-config.ts` |
| **Page file** | `app/travel/esim/page.tsx` |
| **Route-specific `layout.tsx`** under `app/travel/esim/` | **NOT FOUND** |
| **Parent layouts** | Root `app/layout.tsx` only (no `app/travel/layout.tsx` in repo) |
| **Metadata** | Defined in `app/travel/esim/page.tsx`: `title` / `description` / `alternates.canonical` / `openGraph` (`SITE_NAME` from `lib/site-metadata.ts`) |

---

## Current Component Structure

| Layer | File | Role |
|-------|------|------|
| Page shell | `app/travel/esim/page.tsx` | `Header`, `OverseasTravelSubMainNav variant="links"`, `main` with h1 + intro + `EsimCityHub` |
| City hub | `app/components/travel/esim/EsimCityHub.tsx` | Client component: city `Link` tabs, `section` with embed area, optional `next/script` per entry |
| Static resolver | `lib/travel-esim-city-config.ts` | `ESIM_CITY_ENTRIES`, `getEsimCityEntryBySlug`, type `EsimCityEntry` |

---

## Current Data/Backend Status

| Concern | Status |
|---------|--------|
| **Runtime API** (`fetch` / axios / server actions on this route) | **NOT FOUND** |
| **Dedicated mock module** | **NOT FOUND** |
| **Supabase** (E-SIM-specific) | **NOT FOUND** |
| **Prisma / DB tables** (name or field containing `esim`) | **NOT FOUND** |
| **Admin UI / API** (`esim` under `app/admin`, `app/api`) | **NOT FOUND** |
| **Order / payment / catalog** | **NOT FOUND** |
| **Authoritative data** | Static: `lib/travel-esim-city-config.ts` only |

**Unrelated repo strings (not E-SIM feature):** `app/components/travel/MustKnowEssentialsSection.tsx` (copy mentions 유심); `lib/must-know-trip-readiness-filters.ts` (regex includes eSIM/이심/유심); `lib/must-know-web-supplement.ts` (prompt text mentions SIM). No coupling to `/travel/esim`.

---

## Reusable UI Assets

These exist as **shared patterns** in Bongtour; they are not E-SIM–specific business logic.

- **Overseas sub-nav tab tokens:** `components/top-nav/overseas-sub-nav-styles.ts` — `overseasSubNavTabBase`, `overseasSubNavTabIdle`, `overseasSubNavTabActive`
- **Content width alignment:** `lib/site-content-layout.ts` — `SITE_CONTENT_CLASS` (`mx-auto max-w-6xl px-4 sm:px-6`) used by `OverseasTravelSubMainNav`
- **E-SIM page main column:** `app/travel/esim/page.tsx` — `main` uses `max-w-3xl` (narrower than sub-nav row)
- **Page background / shell:** `min-h-screen bg-bt-page` on E-SIM page root `div`
- **Typography / slate scale on E-SIM page:** h1 `text-3xl font-bold tracking-tight text-slate-900`; body `text-base leading-relaxed text-slate-700`; inside `EsimCityHub` h2 `text-lg font-semibold text-slate-900`, helper `text-sm text-slate-600`
- **Card/panel classes on E-SIM page:** see `docs/BONGSIM_UI_REFERENCE_FROM_BONGTOUR.md`

**Sticky CTA on E-SIM route:** **NOT FOUND**

---

## Non-Reusable / Placeholder Parts

- **`ESIM_CITY_ENTRIES` HTML strings:** instructional placeholder paragraphs only (no real iframe/widget markup committed).
- **`EsimCityHub` “business” behavior:** embed slot + `dangerouslySetInnerHTML` + optional external scripts — appropriate only as a **legacy placeholder** until BONGSIM owns commerce/embed policy.
- **Query-driven city UX:** trivial slug lookup; not a product catalog.

---

## Risks If We Build Inside Bongtour Now

1. **Scope creep into travel monolith:** eSIM catalog, payments, fulfillment, and support flows would share deploy, env, and incident surface with unrelated travel product pipelines.
2. **Security / compliance:** third-party embeds, PII, and payment data beside a placeholder `dangerouslySetInnerHTML` pattern increases review burden and accidental data exposure if extended ad hoc.
3. **Navigation coupling:** menu is hardcoded in `overseas-sub-nav-items.ts`; deep product features would tempt more Bongtour-only APIs and DB tables, complicating later extraction.
4. **Brand and SEO confusion:** `/travel/esim` is positioned under “해외여행”; a full retail eSIM product may need separate canonical brand, legal, and refund pages.

---

## Why Separate BONGSIM Project Is Recommended

1. **Current Bongtour E-SIM has no commerce stack** — no API, DB, admin, or orders; building that here would be net-new infrastructure tightly coupled to an unrelated codebase.
2. **Clear integration boundary:** Bongtour can keep a thin entry (menu + optional outbound links) while BONGSIM owns catalog, checkout, webhooks, and operator tools.
3. **Independent release and access control:** BONGSIM can ship security patches, PCI-scoped changes, and supplier integrations without gating the main travel site release train.
