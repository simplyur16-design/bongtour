"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimplyurKoreaPack } from "@/lib/simplyur/catalog/load-korea-catalog";
import {
  collectAvailableDays,
  filterProductsByDays,
  formatPlanMessage,
  minFormattedPrice,
} from "@/lib/simplyur/plans-catalog";
import { SIMPLYUR_PLANS_DESIGN as D } from "@/lib/simplyur/plans-design";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import { SimplyurPlansDurationPicker } from "@/components/simplyur/plans/SimplyurPlansDurationPicker";
import { SimplyurPlansInfoBanner } from "@/components/simplyur/plans/SimplyurPlansInfoBanner";
import { SimplyurPlansKoreaBadge } from "@/components/simplyur/plans/SimplyurPlansKoreaBadge";
import { SimplyurPlansPlanCard } from "@/components/simplyur/plans/SimplyurPlansPlanCard";

type ApiPayload = { pack: SimplyurKoreaPack };

function PlansPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-dashed px-5 py-[22px] text-center text-[13px] leading-relaxed"
      style={{ borderColor: D.border, color: D.faint }}
    >
      {children}
    </div>
  );
}

function PlanSection({
  title,
  products,
  fromLabel,
}: {
  title: string;
  products: SimplyurKoreaPack["roaming"]["products"];
  fromLabel: string | null;
}) {
  if (products.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold" style={{ color: D.navy }}>
          {title}
        </h2>
        {fromLabel ? (
          <p className="text-xs font-semibold" style={{ color: D.faint }}>
            {fromLabel}
          </p>
        ) : null}
      </div>
      <ul className="flex flex-col gap-3">
        {products.map((p) => (
          <li key={p.option_api_id}>
            <SimplyurPlansPlanCard plan={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** design_handoff_plans — duration-first Korea eSIM catalog (Phase 1). */
export function SimplyurRecommendClient({
  initialPack = null,
  initialError = null,
}: {
  initialPack?: SimplyurKoreaPack | null;
  initialError?: string | null;
}) {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();
  const scrollRef = useRef<HTMLElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<ApiPayload | null>(initialPack ? { pack: initialPack } : null);
  const [loading, setLoading] = useState(!initialPack && !initialError);
  const [error, setError] = useState<string | null>(initialError);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch(`/api/simplyur/products/by-country?locale=${locale}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(typeof body.error === "string" ? body.error : `HTTP ${r.status}`);
        }
        return r.json() as Promise<ApiPayload>;
      })
      .then((json) => setData(json))
      .catch(() => setError("load failed"))
      .finally(() => setLoading(false));
  }, [locale]);

  useEffect(() => {
    if (initialPack || initialError) return;
    let cancelled = false;
    load().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [load, initialPack, initialError]);

  const pack = data?.pack ?? null;
  const dayOptions = useMemo(() => (pack ? collectAvailableDays(pack) : []), [pack]);

  const roamingFiltered = useMemo(
    () => (pack && selectedDays != null ? filterProductsByDays(pack.roaming.products, selectedDays) : []),
    [pack, selectedDays],
  );
  const localFiltered = useMemo(
    () =>
      pack?.local && selectedDays != null ? filterProductsByDays(pack.local.products, selectedDays) : [],
    [pack, selectedDays],
  );

  const roamingFrom = minFormattedPrice(roamingFiltered);
  const localFrom = minFormattedPrice(localFiltered);
  const hasRoaming = roamingFiltered.length > 0;
  const hasLocal = localFiltered.length > 0;
  const showNoMatch = selectedDays != null && !hasRoaming && !hasLocal;

  function onChangeDuration() {
    chipsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    scrollRef.current?.scrollTo({ top: chipsRef.current?.offsetTop ?? 0, behavior: "smooth" });
  }

  if (error && !pack) {
    return (
      <main
        ref={scrollRef}
        className="mx-auto flex min-h-[70vh] max-w-lg flex-col px-[22px] py-8 sm:max-w-2xl"
        style={{ backgroundColor: D.bg, paddingBottom: "calc(var(--su-tab-h) + 2rem)" }}
      >
        <SimplyurPlansKoreaBadge />
        <h1 className="mt-2.5 text-[26px] font-extrabold tracking-tight" style={{ color: D.navy }}>
          {tr("recommend.title")}
        </h1>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold"
            style={{ backgroundColor: D.bannerBg, color: D.coral }}
          >
            !
          </span>
          <p className="text-[15px] font-semibold" style={{ color: D.navy }}>
            {tr("recommend.errorTitle")}
          </p>
          <p className="max-w-[240px] text-[13px] leading-relaxed" style={{ color: D.faint }}>
            {tr("recommend.errorBody")}
          </p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-1.5 rounded-2xl px-7 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: D.coral }}
          >
            {tr("recommend.retry")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={scrollRef}
      className="mx-auto max-w-lg px-[22px] py-8 sm:max-w-2xl"
      style={{ backgroundColor: D.bg, paddingBottom: "calc(var(--su-tab-h) + 2.5rem)" }}
    >
      <div className="flex flex-col" style={{ gap: D.sectionGap }}>
        <header className="flex flex-col gap-2.5">
          <SimplyurPlansKoreaBadge />
          <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: D.navy }}>
            {tr("recommend.title")}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: D.muted }}>
            {tr("recommend.subtitle")}
          </p>
        </header>

        <SimplyurPlansInfoBanner />

        {loading && !pack ? (
          <div className="flex flex-col gap-5">
            <p className="text-[13px]" style={{ color: D.faint }}>
              {tr("recommend.loading")}
            </p>
            <div className="flex gap-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-12 w-[76px] rounded-[14px]"
                  style={{ backgroundColor: D.skeleton }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3.5 border bg-white p-[18px]"
                  style={{ borderColor: D.border, borderRadius: D.cardRadius, opacity: i === 2 ? 0.6 : 1 }}
                >
                  <div className="h-[22px] w-[120px] rounded-md" style={{ backgroundColor: D.skeleton }} />
                  <div className="h-6 w-[100px] rounded-md" style={{ backgroundColor: D.skeleton }} />
                  <div className="h-14 rounded-2xl" style={{ backgroundColor: D.skeletonBtn }} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {pack ? (
          <>
            <div ref={chipsRef}>
              <SimplyurPlansDurationPicker
                options={dayOptions}
                value={selectedDays}
                onChange={setSelectedDays}
              />
            </div>

            {selectedDays == null ? (
              <PlansPlaceholder>{tr("recommend.plansPlaceholder")}</PlansPlaceholder>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px]" style={{ color: D.muted }}>
                    {formatPlanMessage(tr("recommend.showingPlansPrefix"), selectedDays)}
                    <strong style={{ color: D.navy }}>{selectedDays}</strong>
                    {tr("recommend.showingPlansSuffix")}
                  </p>
                  <button
                    type="button"
                    onClick={onChangeDuration}
                    className="shrink-0 text-[13px] font-semibold"
                    style={{ color: D.coral }}
                  >
                    {tr("recommend.change")}
                  </button>
                </div>

                {showNoMatch ? (
                  <PlansPlaceholder>
                    {formatPlanMessage(tr("recommend.noPlansForDays"), selectedDays)}
                  </PlansPlaceholder>
                ) : (
                  <>
                    <PlanSection
                      title={tr("recommend.roaming")}
                      products={roamingFiltered}
                      fromLabel={roamingFrom ? `${tr("recommend.fromPrice")} ${roamingFrom}` : null}
                    />
                    <PlanSection
                      title={tr("recommend.local")}
                      products={localFiltered}
                      fromLabel={localFrom ? `${tr("recommend.fromPrice")} ${localFrom}` : null}
                    />
                  </>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
