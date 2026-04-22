# BONGSIM UI Reference From Bongtour

Extracted **only** from current Bongtour files that implement or surround `/travel/esim`. Use for visual parity when BONGSIM is a separate app; replicate classes/tokens, do not import this repo.

---

## Header Reference

| Field | Value |
|-------|--------|
| **File** | `app/components/Header.tsx` |
| **Reuse notes** | Client component; uses `SITE_CONTENT_CLASS` from `lib/site-content-layout.ts` for horizontal alignment with sub-nav. Main nav items in `MAIN_NAV` constant — `해외여행` points to `/travel/overseas`. **E-SIM is not in MAIN_NAV** (see `docs/BONGTOUR_CURRENT_ESIM_AUDIT_FINAL.md`). For BONGSIM: either omit Bongtour header entirely or rebuild a slim header with matching typography/spacing by reading this file. |
| **Utility link class (reference)** | `HEADER_UTIL_LINK_CLASS` in same file — `text-[13px]` … `text-bt-muted`, `hover:bg-bt-page`, `hover:text-bt-link` |

---

## Overseas Sub Navigation Reference

| Field | Value |
|-------|--------|
| **Data** | `components/top-nav/overseas-sub-nav-items.ts` — `OVERSEAS_SUB_NAV_ITEMS` |
| **Desktop row** | `components/top-nav/OverseasSubNavLinksRow.tsx` — default export + `OverseasSubNavMobileScrollRow` |
| **Hub row (mega + links)** | `components/top-nav/OverseasSubNavHubRow.tsx` |
| **Wrapper on travel pages** | `app/components/travel/overseas/OverseasTravelSubMainNav.tsx` |
| **Content width** | `lib/site-content-layout.ts` — `SITE_CONTENT_CLASS = 'mx-auto max-w-6xl px-4 sm:px-6'` |
| **Bar chrome** | `OverseasTravelSubMainNav` outer: `border-y border-bt-border-soft bg-slate-50 shadow-sm` |
| **Reuse notes** | BONGSIM off-origin: copy structure (border-y, muted bg, max-w-6xl padding) rather than importing components. |

---

## Tab Style Reference

| Field | Value |
|-------|--------|
| **Source file** | `components/top-nav/overseas-sub-nav-styles.ts` |
| **`overseasSubNavTabBase`** | `inline-flex min-h-[2.75rem] w-full max-w-none items-center justify-center rounded-lg border px-2 py-2.5 text-center text-[12px] leading-snug tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow] duration-75 ease-out [text-wrap:balance] sm:px-2.5 sm:text-[13px] md:text-[14px] lg:px-3 lg:text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2` |
| **`overseasSubNavTabIdle`** | base + `border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:border-teal-400 hover:bg-teal-50 hover:text-teal-900` |
| **`overseasSubNavTabActive`** | base + `border-teal-500 bg-teal-50 font-semibold text-teal-900 shadow-sm ring-1 ring-inset ring-teal-500/20` |
| **E-SIM city tabs override** | `app/components/travel/esim/EsimCityHub.tsx` — tabs append `` `${tabClass} !w-auto min-w-0 max-w-none shrink-0 px-3 py-2 text-[13px] sm:text-sm` `` |

---

## Layout Container Reference

| Field | Value |
|-------|--------|
| **Page root** | `app/travel/esim/page.tsx` — `div` with `className="min-h-screen bg-bt-page"` |
| **Main** | `className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12"` |
| **Hub vertical stack** | `app/components/travel/esim/EsimCityHub.tsx` — outer `div.space-y-8` |
| **City nav** | `nav` with `className="flex flex-wrap gap-2"` |

---

## Card / Panel Reference (Current E-SIM Page)

| Element | Classes |
|---------|---------|
| Section panel | `rounded-xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6` (`EsimCityHub.tsx`) |
| Embed inner | `esim-embed-root mt-4 min-h-[8rem] rounded-lg border border-dashed border-slate-200 bg-white p-4 text-left [&_iframe]:max-w-full` |

Global design tokens (`bg-bt-page`, `border-bt-border-soft`, etc.) may be documented in `docs/DESIGN-TOKENS-COLOR.md` — **not re-audited here**.

---

## Typography Reference

| Role | Location | Classes / pattern |
|------|-----------|-------------------|
| **h1** | `app/travel/esim/page.tsx` | `text-3xl font-bold tracking-tight text-slate-900` |
| **Intro body** | same | `mt-3 text-base leading-relaxed text-slate-700` |
| **h2 (widget heading)** | `EsimCityHub.tsx` | `text-lg font-semibold text-slate-900` |
| **Section helper** | `EsimCityHub.tsx` | `mt-1 text-sm text-slate-600` |
| **Tab label** | `EsimCityHub.tsx` | `text-[13px] sm:text-sm` on top of tab tokens |

---

## What Not To Reuse

| Item | Reason |
|------|--------|
| **`lib/travel-esim-city-config.ts` placeholder HTML** | Not production content; no supplier contract. |
| **`EsimCityHub` embed logic** | `dangerouslySetInnerHTML` + optional third-party scripts — security-sensitive; replace with vetted BONGSIM components or iframe sandbox strategy decided in BONGSIM. |
| **Empty / instructional copy on current page** | Placeholder UX (“위젯이 표시됩니다”) — rewrite for real catalog. |
| **Assumption that `?city=` stays stable** | Bongtour-specific; BONGSIM should define its own URL scheme if semantics change. |
