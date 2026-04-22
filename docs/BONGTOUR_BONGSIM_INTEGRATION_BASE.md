# Bongtour ↔ Bongsim Integration Base

Cross-repo agreements and **policies to finalize** before linking production traffic. Facts about the current repo are marked **(verified)**; product or legal choices not present in code are marked **(proposed — confirm)**.

---

## Brand Naming Rules

### Bongtour **(verified)**

- **Public site name constant:** `lib/site-metadata.ts` — `SITE_NAME = 'Bong투어'`.
- **Use on Bongtour pages:** travel discovery, supplier-sourced packages, existing booking/inquiry flows, global `Header` / footer context.

### simplyur / 봉심 (eSIM retail) **(proposed — confirm)**

- **In this repo today:** string `simplyur` appears only in operational/bootstrap context (e.g. `lib/bootstrap-user-role.ts`, `scripts/bootstrap-admin.ts` as admin email defaults) — **NOT FOUND** as consumer-facing eSIM brand in UI copy audited for E-SIM.
- **Integration intent:** reserve **Bongsim** (romanization) / **봉심** (Korean) for the standalone eSIM product surface; align with stakeholder “simplyur 봉심” naming offline.
- **When to show which (proposed):**
  - **Bong투어:** any page still hosted on the Bongtour Next app (including `/travel/esim` until replaced or redirected).
  - **봉심 / Bongsim:** checkout, order confirmation, device help, refund policy specific to eSIM SKUs, and external BONGSIM origin UI.
  - **Co-branded handoff (proposed):** short line on outbound link, e.g. “eSIM은 봉심에서 진행됩니다” — exact copy requires legal/marketing sign-off.

---

## Route / Entry Strategy

| Rule | Detail |
|------|--------|
| **Bongtour today** **(verified)** | `/travel/esim` remains a real route: `app/travel/esim/page.tsx`. |
| **Placeholder policy** | Keep route stable until BONGSIM is ready; avoid breaking bookmarks and submenu `href`. |
| **Future standalone BONGSIM** | Own origin (subdomain or separate domain — **NOT FOUND** in repo; decide at deploy). |
| **Suggested Bongtour entry points (proposed)** | (1) Existing overseas submenu link in `components/top-nav/overseas-sub-nav-items.ts` → later `https://<bongsim-host>/…` or intermediate landing. (2) Overseas product detail cross-sell block — **NOT FOUND** today; add only after BONGSIM URL contract exists. (3) Mypage / order lookup — **NOT FOUND** for eSIM today; define API/auth boundary when BONGSIM exposes orders. |

---

## Shared UI Rules

| Topic | Bongtour reference **(verified)** | Direction for BONGSIM **(proposed)** |
|--------|-------------------------------------|----------------------------------------|
| **Header reuse** | `app/components/Header.tsx` | Either **embed** Bongtour header via fragile duplication (not recommended) or **match visually** using extracted tokens (see `docs/BONGSIM_UI_REFERENCE_FROM_BONGTOUR.md`) + Bongsim logo slot. |
| **Subnav reuse** | `OverseasTravelSubMainNav` + `overseas-sub-nav-styles.ts` | If BONGSIM is off-origin, **do not** import React components from Bongtour; **replicate** tab/bar spacing and teal active ring pattern. |
| **Card radius** | E-SIM page: outer `rounded-xl`, inner `rounded-lg` (`app/components/travel/esim/EsimCityHub.tsx`) | Align Bongsim cards to same radius steps for familial look. |
| **Spacing rhythm** | Page: `mt-3`, `mt-8`; hub: `space-y-8`, `gap-2`, `mt-4`, `p-5 sm:p-6` | Keep 4/8 scale consistency (`mt-8` section breaks). |
| **Button / tab style** | Tabs use `overseasSubNavTabActive` / `overseasSubNavTabIdle` | Primary actions: same teal-adjacent focus ring (`focus-visible:ring-teal-500`) at minimum for keyboard parity. |
| **Mobile-first** | `OverseasSubNavMobileScrollRow` uses grid `grid-cols-2` → `sm:grid-cols-4` (`components/top-nav/OverseasSubNavLinksRow.tsx`) | BONGSIM: test checkout from 320px width; sticky cart optional. |
| **Sticky CTA** | **NOT FOUND** on current E-SIM page | **(proposed)** BONGSIM catalog/detail: sticky bottom bar on mobile for “선택 요약 / 다음” once commerce exists. |

---

## Shared Data Rules

All rows below are **(proposed — confirm)** unless a Bongtour file is cited.

| Topic | Policy |
|--------|--------|
| **Country code** | Use **ISO 3166-1 alpha-2** in APIs and URLs where machine-readable country is required; document display mapping separately. |
| **Country label** | Korean primary label for Bongtour audience; keep a single canonical `labelKo` + optional `labelEn` in BONGSIM if SKUs are English-supplier sourced. |
| **Price display** | `₩` + thousands grouping consistent with Bongtour money displays elsewhere (audit per page at integration time). |
| **Date format** | Korean locale `YYYY.MM.DD` or `YYYY년 M월 D일` — pick one SSOT for BONGSIM receipts and mirror in any Bongtour cross-links. |
| **Route query (`city` / country)** | Bongtour today: `?city=<slug>` on `/travel/esim` **(verified)**. BONGSIM: define new query/param contract; avoid reusing `city=` if semantics change from “marketing region” to “SKU region”. |
| **Order status naming** | **NOT FOUND** in Bongtour for eSIM. Propose internal enums: `draft`, `pending_payment`, `paid`, `fulfilled`, `cancelled`, `refunded` — map to Korean UI labels in one i18n map. |
| **Payment status naming** | **NOT FOUND** for eSIM. Propose: `initiated`, `authorized`, `captured`, `failed`, `refunded` — align with PG vendor terms in admin-only English, user-facing Korean. |

---

## Shared Customer Experience Rules **(proposed — confirm)**

| Area | Rule |
|------|------|
| **Tone** | Informative, calm, travel-agency adjacency (Bongtour `buildPublicProductDescription` style in `lib/site-metadata.ts` emphasizes 일정·안내·문의 — not hard-sell). |
| **Support wording** | Single support path per surface; avoid duplicate Kakao/phone blocks unless staffed. |
| **Refund / policy** | Host authoritative refund and “activation 후 환불 불가” style clauses on **BONGSIM** legal pages; Bongtour links out with one sentence summary. |
| **Device compatibility** | Surface **before** payment: iOS/Android version, eSIM-capable handset, lock status — placement: product detail accordion + checkout acknowledgment checkbox. |
| **Travel-centric messaging** | Tie SKU to destination and trip length (days/data), not generic “data only” telco tone. |

---

## Integration Boundaries

| Owner | Owns |
|--------|------|
| **Bongtour** | Travel product browse/detail, supplier registration flows, existing auth to `/mypage`, global `Header`/`ConditionalSiteFooter`, **current** `/travel/esim` placeholder until deliberately replaced or linked out. |
| **BONGSIM** | eSIM SKU catalog, inventory/entitlement from supplier, checkout, payment webhooks, customer-visible order state, device/install instructions, eSIM-specific CS and policy pages. |
| **Never duplicate** | Single source of truth for **paid order state**, **refund eligibility**, **PCI card data**, and **supplier API secrets** — these must not be copied into both codebases “for convenience.” |
