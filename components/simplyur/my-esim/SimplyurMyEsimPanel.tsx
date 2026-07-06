"use client";

import Link from "next/link";
import Image from "next/image";
import {
  SIMPLYUR_MY_ESIM_DESIGN as D,
  MY_ESIM_BADGE,
  type MyEsimView,
} from "@/lib/simplyur/my-esim-design";
import {
  buildUsageSummaryView,
  chartBarHeight,
  formatOrderDate,
  myEsimBadgeTier,
  weekdayLabel,
  type MyEsimOrderRow,
  type MyEsimUsageResponse,
} from "@/lib/simplyur/my-esim-view-model";
import { simplyurPath } from "@/lib/simplyur/constants";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = {
  view: MyEsimView;
  orders: MyEsimOrderRow[];
  selectedOrder: MyEsimOrderRow | null;
  detailUsage: MyEsimUsageResponse | null;
  usageModalOpen: boolean;
  usageModalLoading: boolean;
  usageModalError: string | null;
  loadError?: boolean;
  onSelectOrder: (orderId: string) => void;
  onBackToList: () => void;
  onOpenUsageModal: () => void;
  onCloseUsageModal: () => void;
};

/** design_handoff_my_esim — My eSIM tab */
export function SimplyurMyEsimPanel({
  view,
  orders,
  selectedOrder,
  detailUsage,
  usageModalOpen,
  usageModalLoading,
  usageModalError,
  loadError = false,
  onSelectOrder,
  onBackToList,
  onOpenUsageModal,
  onCloseUsageModal,
}: Props) {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();
  const signInHref = simplyurPath(locale, "/sign-in");
  const plansHref = simplyurPath(locale, "/recommend");
  const callback = encodeURIComponent(simplyurPath(locale, "/my-esim"));

  if (view === "loading") {
    return (
      <Shell>
        <p className="text-sm" style={{ color: D.muted }}>
          {tr("myEsim.loading")}
        </p>
      </Shell>
    );
  }

  if (view === "signin") {
    return (
      <CenterState
        icon="🔒"
        title={tr("myEsim.signInTitle")}
        body={tr("myEsim.signInBody")}
        cta={
          <Link
            href={`${signInHref}?callbackUrl=${callback}`}
            className="flex h-[52px] w-full max-w-[280px] items-center justify-center rounded-2xl text-[15px] font-semibold text-white"
            style={{ backgroundColor: D.coral }}
          >
            {tr("nav.signIn")}
          </Link>
        }
      />
    );
  }

  if (view === "empty") {
    return (
      <CenterState
        icon="📶"
        title={tr("myEsim.emptyTitle")}
        body={loadError ? tr("myEsim.loadError") : tr("myEsim.emptyBody")}
        cta={
          <Link
            href={plansHref}
            className="flex h-[52px] w-full max-w-[280px] items-center justify-center rounded-2xl text-[15px] font-semibold text-white"
            style={{ backgroundColor: D.coral }}
          >
            {tr("myEsim.emptyCta")}
          </Link>
        }
      />
    );
  }

  if (view === "detail" && selectedOrder) {
    const tier = myEsimBadgeTier(selectedOrder.status_key);
    const badge = MY_ESIM_BADGE[tier];
    const summary = buildUsageSummaryView(selectedOrder, detailUsage, tr);
    const modalUsage = usageModalOpen ? detailUsage : null;
    const modalSummary = buildUsageSummaryView(selectedOrder, modalUsage, tr);
    const maxDaily =
      modalUsage?.history?.length ?
        Math.max(1, ...modalUsage.history.map((h) => h.usageMb))
      : 1;

    return (
      <Shell relative>
        <button
          type="button"
          onClick={onBackToList}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
          style={{ color: D.coral }}
        >
          <span className="text-base" aria-hidden>
            ←
          </span>
          {tr("myEsim.backToList")}
        </button>

        <div className="flex flex-col gap-1.5">
          <span
            className="w-fit rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ backgroundColor: badge.bg, color: badge.color }}
          >
            {tr(badge.labelKey)}
          </span>
          <h1 className="text-xl font-extrabold" style={{ color: D.navy }}>
            {selectedOrder.plan_summary}
          </h1>
          <p className="text-xs" style={{ color: D.faint }}>
            {tr("myEsim.orderedOn")} {formatOrderDate(selectedOrder.created_at, locale)}
          </p>
        </div>

        <div
          className="flex flex-col items-center gap-3 border bg-white p-[22px]"
          style={{ borderColor: D.border, borderRadius: D.panelRadius }}
        >
          {selectedOrder.can_show_qr && selectedOrder.qr_code_img_url ? (
            <div className="relative h-[168px] w-[168px] overflow-hidden rounded-[14px] bg-[#f8f8f8]">
              <Image
                src={selectedOrder.qr_code_img_url}
                alt="eSIM QR"
                fill
                className="object-contain p-2"
                unoptimized
              />
            </div>
          ) : (
            <div
              className="flex h-[168px] w-[168px] items-center justify-center rounded-[14px]"
              style={{
                background:
                  "repeating-linear-gradient(45deg, #12233F 0 6px, #fff 6px 12px)",
              }}
            >
              <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold" style={{ color: D.navy }}>
                QR CODE
              </span>
            </div>
          )}
          <p className="text-center text-xs" style={{ color: D.muted }}>
            {tr("myEsim.qrHint")}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenUsageModal}
          className="flex w-full items-center justify-between border bg-white p-[18px] text-left"
          style={{ borderColor: D.border, borderRadius: D.panelRadius }}
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs" style={{ color: D.faint }}>
              {tr("myEsim.usageCardLabel")}
            </span>
            <span className="text-base font-bold" style={{ color: D.navy }}>
              {summary.usageLabel}
            </span>
            {summary.hasCap ? (
              <div
                className="mt-0.5 h-1.5 w-[120px] overflow-hidden rounded-full"
                style={{ backgroundColor: D.progressTrack }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${summary.usedPct}%`, backgroundColor: D.coral }}
                />
              </div>
            ) : null}
          </div>
          <span style={{ color: D.faint }} aria-hidden>
            ›
          </span>
        </button>

        {usageModalOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ backgroundColor: D.overlay }}
            role="dialog"
            aria-modal
            onClick={onCloseUsageModal}
          >
            <div
              className="w-full max-w-lg px-[22px] pb-8 pt-[22px]"
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: D.modalRadius,
                borderTopRightRadius: D.modalRadius,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-[18px] flex items-center justify-between">
                <span className="text-base font-extrabold" style={{ color: D.navy }}>
                  {tr("myEsim.usageTitle")}
                </span>
                <button
                  type="button"
                  onClick={onCloseUsageModal}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
                  style={{ backgroundColor: D.divider, color: D.muted }}
                  aria-label={tr("myEsim.close")}
                >
                  ✕
                </button>
              </div>

              {usageModalLoading ? (
                <p className="text-sm" style={{ color: D.muted }}>
                  {tr("myEsim.loading")}
                </p>
              ) : null}
              {usageModalError ? (
                <p className="text-sm text-red-600">{usageModalError}</p>
              ) : null}

              {modalUsage ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[28px] font-extrabold" style={{ color: D.navy }}>
                      {modalSummary.usedDisplay}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: D.faint }}>
                      {modalSummary.usedOfLabel}
                    </span>
                  </div>
                  {modalSummary.sublabel ? (
                    <p className="-mt-2 text-xs" style={{ color: D.faint }}>
                      {modalSummary.sublabel}
                    </p>
                  ) : null}

                  {modalSummary.hasCap ? (
                    <div className="mt-4 flex flex-col gap-2">
                      <div
                        className="h-2.5 w-full overflow-hidden rounded-full"
                        style={{ backgroundColor: D.progressTrack }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${modalSummary.usedPct}%`, backgroundColor: D.coral }}
                        />
                      </div>
                      <div className="flex justify-between text-xs" style={{ color: D.muted }}>
                        <span>
                          {modalSummary.usedDisplay} {tr("myEsim.usedWord")}
                        </span>
                        <span className="font-bold" style={{ color: D.navy }}>
                          {modalSummary.remainingDisplay} {tr("myEsim.leftWord")}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {modalUsage.history.length > 0 ? (
                    <div className="mt-4 flex h-[100px] items-end gap-2 pt-2">
                      {modalUsage.history.slice(-7).map((h, i, arr) => {
                        const isLast = i === arr.length - 1;
                        const hPx = chartBarHeight(h.usageMb, maxDaily);
                        return (
                          <div key={h.date} className="flex flex-1 flex-col items-center gap-1.5">
                            <div
                              className="w-full max-w-[22px] rounded-md"
                              style={{
                                height: hPx,
                                backgroundColor: isLast ? D.coral : D.barMuted,
                              }}
                            />
                            <span className="text-[10px]" style={{ color: D.faint }}>
                              {weekdayLabel(h.date, locale)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs" style={{ color: D.faint }}>
                      {tr("myEsim.noDailyUsage")}
                    </p>
                  )}
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-[22px] font-extrabold" style={{ color: D.navy }}>
        {tr("myEsim.title")}
      </h1>
      <div className="flex flex-col gap-3">
        {orders.map((o) => {
          const tier = myEsimBadgeTier(o.status_key);
          const badge = MY_ESIM_BADGE[tier];
          return (
            <button
              key={o.order_id}
              type="button"
              onClick={() => onSelectOrder(o.order_id)}
              className="flex w-full items-center justify-between border bg-white px-[18px] py-4 text-left"
              style={{ borderColor: D.border, borderRadius: D.cardRadius }}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-xs" style={{ color: D.faint }}>
                  {formatOrderDate(o.created_at, locale)}
                </span>
                <span className="text-sm font-bold" style={{ color: D.navy }}>
                  {o.plan_summary}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ backgroundColor: badge.bg, color: badge.color }}
                >
                  {tr(badge.labelKey)}
                </span>
                <span style={{ color: D.faint }} aria-hidden>
                  ›
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({
  children,
  relative,
}: {
  children: React.ReactNode;
  relative?: boolean;
}) {
  return (
    <main
      className={`mx-auto max-w-lg px-[22px] py-8 sm:max-w-2xl ${relative ? "relative" : ""}`}
      style={{ backgroundColor: D.bg, paddingBottom: "calc(var(--su-tab-h) + 2rem)", minHeight: "60vh" }}
    >
      <div className="flex flex-col" style={{ gap: D.sectionGap }}>
        {children}
      </div>
    </main>
  );
}

function CenterState({
  icon,
  title,
  body,
  cta,
}: {
  icon: string;
  title: string;
  body: string;
  cta: React.ReactNode;
}) {
  return (
    <main
      className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-10 py-10 sm:max-w-2xl"
      style={{ backgroundColor: D.bg, paddingBottom: "calc(var(--su-tab-h) + 2rem)" }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full text-[28px]"
        style={{ backgroundColor: D.iconCircleBg }}
        aria-hidden
      >
        {icon}
      </div>
      <h1 className="text-center text-[19px] font-extrabold" style={{ color: D.navy }}>
        {title}
      </h1>
      <p className="max-w-[260px] text-center text-[13px] leading-relaxed" style={{ color: D.muted }}>
        {body}
      </p>
      <div className="mt-2 w-full max-w-[280px]">{cta}</div>
    </main>
  );
}
