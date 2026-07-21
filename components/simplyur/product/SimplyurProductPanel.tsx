"use client";

import Link from "next/link";
import { SIMPLYUR_CHECKOUT_ENABLED, simplyurPath } from "@/lib/simplyur/constants";
import {
  SIMPLYUR_PRODUCT_DESIGN as D,
  type SimplyurProductViewState,
} from "@/lib/simplyur/product-design";
import {
  formatSimplyurProductTitle,
  simplyurNetworkLabelFromFamily,
} from "@/lib/simplyur/product-title";
import type { SimplyurPublicProduct } from "@/lib/simplyur/public-product";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = {
  state: SimplyurProductViewState;
  product: SimplyurPublicProduct | null;
  checkoutEnabled?: boolean;
};

/** design_handoff_product — Product detail [05] */
export function SimplyurProductPanel({
  state,
  product,
  checkoutEnabled = SIMPLYUR_CHECKOUT_ENABLED,
}: Props) {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();
  const plansHref = simplyurPath(locale, "/recommend");
  const checkoutHref =
    product != null
      ? simplyurPath(locale, `/checkout?optionApiId=${encodeURIComponent(product.option_api_id)}`)
      : plansHref;

  const networkLabel =
    product != null
      ? simplyurNetworkLabelFromFamily(
          product.network_family,
          tr("recommend.roaming"),
          tr("recommend.local"),
        )
      : "";

  const title =
    product != null
      ? formatSimplyurProductTitle(locale, {
          days: product.days,
          dataLabel: product.data_label,
          networkLabel,
        })
      : "";

  const priceFormatted = product?.simplyur_display?.formatted ?? "—";
  const perDayFormatted = product?.simplyur_display_per_day?.formatted;

  return (
    <main
      className="mx-auto max-w-lg px-[22px] py-8 sm:max-w-2xl"
      style={{ backgroundColor: D.bg, paddingBottom: "calc(var(--su-tab-h) + 2rem)", minHeight: "60vh" }}
    >
      <div className="flex flex-col" style={{ gap: D.sectionGap }}>
        <Link
          href={plansHref}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
          style={{ color: D.coral }}
        >
          <span className="text-base" aria-hidden>
            ←
          </span>
          {tr("product.backToPlans")}
        </Link>

        {state === "loading" ? <ProductSkeleton /> : null}

        {state === "not_found" ? (
          <div
            className="flex flex-col items-center gap-2.5 border border-dashed px-[22px] py-8 text-center"
            style={{ borderColor: D.border, borderRadius: 16 }}
          >
            <span className="text-[28px]" aria-hidden>
              🔍
            </span>
            <p className="text-[15px] font-bold" style={{ color: D.navy }}>
              {tr("product.notFoundTitle")}
            </p>
            <p className="max-w-[260px] text-[13px] leading-relaxed" style={{ color: D.muted }}>
              {tr("product.notFoundBody")}
            </p>
            <Link href={plansHref} className="mt-1.5 text-[13px] font-semibold" style={{ color: D.coral }}>
              {tr("product.backToPlans")}
            </Link>
          </div>
        ) : null}

        {state === "loaded" && product ? (
          <div className="flex flex-col" style={{ gap: D.sectionGap }}>
            <h1 className="text-2xl font-extrabold leading-snug" style={{ color: D.navy }}>
              {title}
            </h1>

            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="font-extrabold leading-none" style={{ fontSize: D.priceSize, color: D.coral }}>
                {priceFormatted}
              </p>
              {perDayFormatted ? (
                <p className="text-sm font-semibold" style={{ color: D.faint }}>
                  {tr("recommend.perDay").replace("{amount}", perDayFormatted)}
                </p>
              ) : null}
            </div>

            <DetailPanel
              network={networkLabel}
              duration={product.days_label}
              data={product.data_label}
              networkLabel={tr("product.network")}
              durationLabel={tr("recommend.duration")}
              dataLabel={tr("recommend.data")}
            />

            {checkoutEnabled ? (
              <Link
                href={checkoutHref}
                className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white transition hover:opacity-95"
                style={{ backgroundColor: D.coral, boxShadow: D.ctaShadow }}
              >
                {tr("product.buyNow")}
              </Link>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled
                  className="flex h-14 w-full cursor-not-allowed items-center justify-center rounded-2xl text-base font-semibold"
                  style={{ backgroundColor: D.disabledFill, color: D.faint }}
                >
                  {tr("product.checkoutSoon")}
                </button>
                <p className="text-center text-xs leading-relaxed" style={{ color: D.faint }}>
                  {tr("product.checkoutSoonHint")}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}

function DetailPanel({
  network,
  duration,
  data,
  networkLabel,
  durationLabel,
  dataLabel,
}: {
  network: string;
  duration: string;
  data: string;
  networkLabel: string;
  durationLabel: string;
  dataLabel: string;
}) {
  const rows = [
    { label: networkLabel, value: network },
    { label: durationLabel, value: duration },
    { label: dataLabel, value: data },
  ];

  return (
    <div
      className="flex flex-col border bg-white p-[18px]"
      style={{ borderColor: D.border, borderRadius: D.cardRadius }}
    >
      {rows.map((row, i) => (
        <div
          key={row.label}
          className="flex items-center justify-between py-3"
          style={{
            borderBottom: i < rows.length - 1 ? `1px solid ${D.divider}` : undefined,
          }}
        >
          <span className="text-[13px]" style={{ color: D.muted }}>
            {row.label}
          </span>
          <span className="text-sm font-bold" style={{ color: D.navy }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-7 w-3/4 rounded-lg animate-pulse" style={{ backgroundColor: D.skeleton }} />
      <div className="h-[38px] w-[45%] rounded-lg animate-pulse" style={{ backgroundColor: D.skeleton }} />
      <div className="h-[150px] w-full rounded-[18px] animate-pulse" style={{ backgroundColor: D.skeleton }} />
      <div className="h-14 w-full rounded-2xl animate-pulse" style={{ backgroundColor: D.skeleton }} />
    </div>
  );
}
