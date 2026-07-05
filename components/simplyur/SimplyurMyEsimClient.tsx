"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import { simplyurPath } from "@/lib/simplyur/constants";

type OrderRow = {
  order_id: string;
  order_number: string;
  status_key: string;
  plan_summary: string;
  grand_total_krw: string;
  created_at: string;
  qr_code_img_url: string | null;
  sm_dp_plus_address: string | null;
  activation_code: string | null;
  can_show_qr: boolean;
  can_check_usage: boolean;
};

type UsageResponse = {
  total_used_mb: number;
  unlimited: boolean;
  cap_mb: number | null;
  history: { date: string; usageMb: number }[];
};

const STATUS_KEYS = new Set([
  "ordered",
  "paid",
  "delivered",
  "active",
  "failed",
  "cancelled",
  "refundPending",
]);

function mbToGb(mb: number): string {
  return (mb / 1024).toFixed(1);
}

export function SimplyurMyEsimClient() {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState<OrderRow | null>(null);
  const [usageFor, setUsageFor] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [usageErr, setUsageErr] = useState<string | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/simplyur/mypage/orders?locale=${encodeURIComponent(locale)}`, {
        cache: "no-store",
      });
      const j = (await res.json()) as { orders?: OrderRow[]; error?: string };
      if (res.status === 401) {
        setErr(tr("myEsim.signInRequired"));
        setRows([]);
        return;
      }
      if (!res.ok) throw new Error(j.error ?? "load_failed");
      setRows(j.orders ?? []);
    } catch {
      setErr(tr("myEsim.loadError"));
    } finally {
      setLoading(false);
    }
  }, [tr, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDaily = useMemo(() => {
    if (!usage?.history?.length) return 1;
    return Math.max(1, ...usage.history.map((h) => h.usageMb));
  }, [usage]);

  const openUsage = async (orderId: string) => {
    setUsageFor(orderId);
    setUsage(null);
    setUsageErr(null);
    setUsageLoading(true);
    try {
      const res = await fetch(`/api/simplyur/mypage/usage?orderId=${encodeURIComponent(orderId)}`, {
        cache: "no-store",
      });
      const j = (await res.json()) as UsageResponse & { error?: string };
      if (!res.ok) throw new Error(j.error ?? "usage_failed");
      setUsage(j);
    } catch {
      setUsageErr(tr("myEsim.usageError"));
    } finally {
      setUsageLoading(false);
    }
  };

  const statusLabel = (key: string) =>
    STATUS_KEYS.has(key) ? tr(`myEsim.status.${key}`) : tr("myEsim.status.ordered");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-[color:var(--su-ink)]">{tr("myEsim.title")}</h1>
      <p className="mt-2 text-sm text-[color:var(--su-ink-muted)]">{tr("myEsim.subtitle")}</p>

      {loading ? <p className="mt-8 text-sm text-[color:var(--su-ink-muted)]">{tr("myEsim.loading")}</p> : null}
      {err ? (
        <p className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}{" "}
          <Link href={simplyurPath(locale, "/sign-in")} className="font-semibold underline">
            {tr("nav.signIn")}
          </Link>
        </p>
      ) : null}

      <div className="mt-8 space-y-4">
        {rows.map((o) => (
          <article key={o.order_id} className="su-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[color:var(--su-ink)]">{tr("countries.kr.name")}</p>
                <p className="mt-0.5 text-sm text-[color:var(--su-ink-muted)]">{o.plan_summary}</p>
                <p className="mt-0.5 font-mono text-xs text-[color:var(--su-ink-muted)]">{o.order_number}</p>
              </div>
              <span className="rounded-full bg-[color:var(--su-brand-bg-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--su-brand-ur)]">
                {statusLabel(o.status_key)}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-[color:var(--su-ink-muted)]">{tr("myEsim.orderDate")}</dt>
                <dd className="font-medium">
                  {new Date(o.created_at).toLocaleDateString(locale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[color:var(--su-ink-muted)]">{tr("myEsim.orderNo")}</dt>
                <dd className="font-mono text-xs">{o.order_number}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              {o.can_show_qr && o.qr_code_img_url ? (
                <button type="button" className="su-btn-navy px-4 py-2 text-sm" onClick={() => setQrModal(o)}>
                  {tr("myEsim.viewQr")}
                </button>
              ) : null}
              {o.can_check_usage ? (
                <button
                  type="button"
                  className="rounded-full border border-[color:var(--su-hanji-border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--su-ink)] hover:bg-[color:var(--su-brand-bg-soft)]"
                  onClick={() => void openUsage(o.order_id)}
                >
                  {tr("myEsim.viewUsage")}
                </button>
              ) : null}
            </div>
          </article>
        ))}

        {!loading && rows.length === 0 && !err ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--su-hanji-border)] py-12 text-center">
            <p className="text-sm text-[color:var(--su-ink-muted)]">{tr("myEsim.empty")}</p>
            <Link href={simplyurPath(locale, "/recommend")} className="su-btn-navy mt-4 inline-flex px-6 py-2.5 text-sm">
              {tr("hero.cta")}
            </Link>
          </div>
        ) : null}
      </div>

      {qrModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal
          onClick={() => setQrModal(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{tr("myEsim.qrTitle")}</h2>
              <button type="button" className="text-sm text-[color:var(--su-ink-muted)]" onClick={() => setQrModal(null)}>
                {tr("myEsim.close")}
              </button>
            </div>
            {qrModal.qr_code_img_url ? (
              <div className="mt-4 flex justify-center rounded-xl bg-[color:var(--su-brand-bg-soft)] p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrModal.qr_code_img_url}
                  alt="eSIM QR"
                  className="max-h-[min(70vh,320px)] w-full max-w-[320px] object-contain"
                />
              </div>
            ) : null}
            {qrModal.sm_dp_plus_address ? (
              <div className="mt-4">
                <p className="text-xs font-medium text-[color:var(--su-ink-muted)]">SM-DP+</p>
                <p className="mt-1 break-all rounded-lg bg-[color:var(--su-brand-bg-soft)] p-3 font-mono text-xs">
                  {qrModal.sm_dp_plus_address}
                </p>
              </div>
            ) : null}
            {qrModal.activation_code ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-[color:var(--su-ink-muted)]">{tr("myEsim.activationCode")}</p>
                <p className="mt-1 break-all rounded-lg bg-[color:var(--su-brand-bg-soft)] p-3 font-mono text-xs">
                  {qrModal.activation_code}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {usageFor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal
          onClick={() => {
            setUsageFor(null);
            setUsage(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{tr("myEsim.usageTitle")}</h2>
              <button
                type="button"
                className="text-sm text-[color:var(--su-ink-muted)]"
                onClick={() => {
                  setUsageFor(null);
                  setUsage(null);
                }}
              >
                {tr("myEsim.close")}
              </button>
            </div>
            {usageLoading ? <p className="mt-6 text-sm text-[color:var(--su-ink-muted)]">{tr("myEsim.loading")}</p> : null}
            {usageErr ? <p className="mt-4 text-sm text-red-600">{usageErr}</p> : null}
            {usage ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm">
                  {tr("myEsim.used")}: <strong>{mbToGb(usage.total_used_mb)} GB</strong>
                  {usage.unlimited ? ` (${tr("myEsim.unlimited")})` : null}
                  {!usage.unlimited && usage.cap_mb != null ? (
                    <>
                      {" "}
                      / {mbToGb(usage.cap_mb)} GB
                    </>
                  ) : null}
                </p>
                {usage.history.length > 0 ? (
                  <div className="flex h-32 items-end gap-0.5 border-b border-[color:var(--su-hanji-border)]">
                    {usage.history.map((h) => {
                      const barH = Math.max(4, Math.round((h.usageMb / maxDaily) * 100));
                      return (
                        <div key={h.date} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${h.date}: ${h.usageMb}MB`}>
                          <div
                            className="w-full max-w-[14px] rounded-t bg-[color:var(--su-brand-ur)]"
                            style={{ height: barH }}
                          />
                          <span className="text-[8px] text-[color:var(--su-ink-muted)]">{h.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[color:var(--su-ink-muted)]">{tr("myEsim.noDailyUsage")}</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
