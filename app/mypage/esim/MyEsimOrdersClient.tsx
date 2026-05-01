"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type OrderRow = {
  order_id: string;
  order_number: string;
  status: string;
  display_status: string;
  grand_total_krw: string;
  created_at: string;
  plan_name: string;
  option_label: string;
  allowance_label: string;
  country_flag: string;
  country_label: string;
  qr_code_img_url: string | null;
  can_show_qr: boolean;
  can_check_usage: boolean;
};

type UsageResponse = {
  total_used_mb: number;
  unlimited: boolean;
  cap_mb: number | null;
  allowance_label: string;
  history: { date: string; usageMb: number }[];
  error?: string;
};

function formatKrw(raw: string): string {
  const v = Number.parseInt(raw, 10);
  if (!Number.isFinite(v)) return raw;
  return `${v.toLocaleString("ko-KR")}원`;
}

function mbToGbOneDecimal(mb: number): string {
  return (mb / 1024).toFixed(1);
}

function badgeClass(display: string): string {
  if (display === "주문완료") return "bg-slate-500 text-white";
  if (display === "결제완료") return "bg-teal-600 text-white";
  if (display === "발송완료") return "bg-emerald-600 text-white";
  if (display === "사용중") return "bg-cyan-600 text-white";
  if (display === "실패") return "bg-red-600 text-white";
  if (display === "취소") return "bg-amber-500 text-slate-900";
  return "bg-slate-400 text-white";
}

export default function MyEsimOrdersClient() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [usageFor, setUsageFor] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [usageErr, setUsageErr] = useState<string | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/bongsim/mypage/orders", { cache: "no-store" });
      const j = (await res.json()) as { orders?: OrderRow[]; error?: string };
      if (res.status === 401) {
        setErr("로그인이 필요합니다.");
        setRows([]);
        return;
      }
      if (!res.ok) throw new Error(j.error ?? "목록을 불러오지 못했습니다.");
      setRows(j.orders ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
    }
  }, []);

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
      const res = await fetch(`/api/bongsim/mypage/usage?orderId=${encodeURIComponent(orderId)}`, {
        cache: "no-store",
      });
      const j = (await res.json()) as UsageResponse & { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(j.error === "no_topup" ? "아직 발급 정보가 없습니다." : j.message ?? j.error ?? "조회 실패");
      }
      setUsage(j);
    } catch (e) {
      setUsageErr(e instanceof Error ? e.message : "오류");
    } finally {
      setUsageLoading(false);
    }
  };

  return (
    <div className="text-slate-800">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">내 eSIM</h1>
      <p className="mt-2 text-sm text-slate-600">로그인 계정 이메일과 동일한 구매자 이메일로 결제한 주문만 표시됩니다.</p>

      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}

      <div className="mt-8 space-y-4">
        {rows.map((o) => (
          <article
            key={o.order_id}
            className="rounded-2xl border border-teal-100/90 bg-white/95 p-4 shadow-sm backdrop-blur-sm sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 gap-3">
                <span className="text-3xl leading-none" aria-hidden>
                  {o.country_flag}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{o.country_label}</p>
                  <p className="mt-0.5 truncate text-sm text-slate-600" title={o.plan_name}>
                    {o.plan_name}
                  </p>
                  {o.option_label ? (
                    <p className="mt-0.5 text-xs text-slate-500">{o.option_label}</p>
                  ) : null}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(o.display_status)}`}
              >
                {o.display_status}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">주문일</dt>
                <dd className="font-medium text-slate-800">
                  {new Date(o.created_at).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">결제금액</dt>
                <dd className="font-medium text-teal-800">{formatKrw(o.grand_total_krw)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">주문번호</dt>
                <dd className="font-mono text-xs text-slate-700">{o.order_number}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              {o.can_show_qr && o.qr_code_img_url ? (
                <button
                  type="button"
                  className="rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-teal-600 hover:to-cyan-700"
                  onClick={() => setQrUrl(o.qr_code_img_url)}
                >
                  QR코드 보기
                </button>
              ) : null}
              {o.can_check_usage ? (
                <button
                  type="button"
                  className="rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-2 text-sm font-semibold text-teal-900 transition hover:bg-teal-100"
                  onClick={() => void openUsage(o.order_id)}
                >
                  데이터 사용량 확인
                </button>
              ) : null}
            </div>
          </article>
        ))}

        {rows.length === 0 && !err ? (
          <p className="rounded-2xl border border-dashed border-teal-200 bg-white/60 py-12 text-center text-sm text-slate-500">
            아직 eSIM 주문 내역이 없습니다.
          </p>
        ) : null}
      </div>

      {qrUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal
          onClick={() => setQrUrl(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-teal-100 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">eSIM QR</h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
                onClick={() => setQrUrl(null)}
              >
                닫기
              </button>
            </div>
            <div className="mt-4 flex justify-center rounded-xl bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- 외부 USIMSA QR URL 동적 도메인 */}
              <img src={qrUrl} alt="eSIM QR 코드" className="max-h-[min(70vh,320px)] w-full max-w-[320px] object-contain" />
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">설치 앱에서 QR을 스캔해 주세요.</p>
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
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-teal-100 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">데이터 사용량</h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
                onClick={() => {
                  setUsageFor(null);
                  setUsage(null);
                }}
              >
                닫기
              </button>
            </div>

            {usageLoading ? <p className="mt-6 text-sm text-slate-500">불러오는 중…</p> : null}
            {usageErr ? <p className="mt-4 text-sm text-red-600">{usageErr}</p> : null}

            {usage ? (
              <div className="mt-4 space-y-5">
                <div>
                  {usage.unlimited ? (
                    <p className="text-sm font-medium text-slate-800">
                      사용량: <span className="text-teal-700">{mbToGbOneDecimal(usage.total_used_mb)}GB</span>
                      <span className="text-slate-500"> (무제한)</span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-700">
                      사용량{" "}
                      <span className="font-semibold text-teal-800">{mbToGbOneDecimal(usage.total_used_mb)}GB</span>
                      {usage.cap_mb != null ? (
                        <>
                          {" "}
                          / 총 <span className="font-medium">{mbToGbOneDecimal(usage.cap_mb)}GB</span>
                        </>
                      ) : (
                        <span className="text-slate-500"> (플랜 용량 정보 없음)</span>
                      )}
                    </p>
                  )}
                  <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all"
                      style={{
                        width: usage.unlimited
                          ? "100%"
                          : usage.cap_mb != null && usage.cap_mb > 0
                            ? `${Math.min(100, (usage.total_used_mb / usage.cap_mb) * 100)}%`
                            : "0%",
                      }}
                    />
                  </div>
                  {usage.allowance_label ? (
                    <p className="mt-1 text-xs text-slate-500">플랜: {usage.allowance_label}</p>
                  ) : null}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">일별 사용량</h3>
                  {usage.history.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">일별 기록이 없습니다.</p>
                  ) : (
                    <div className="mt-3 flex h-40 items-end gap-0.5 border-b border-slate-200 px-0.5 pb-0.5">
                      {usage.history.map((h) => {
                        const barH = Math.max(4, Math.round((h.usageMb / maxDaily) * 120));
                        return (
                          <div
                            key={h.date}
                            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                            title={`${h.date}: ${h.usageMb.toFixed(1)}MB`}
                          >
                            <div
                              className="w-full max-w-[18px] rounded-t-md bg-gradient-to-t from-teal-500 to-cyan-400"
                              style={{ height: barH }}
                            />
                            <span className="max-w-full truncate text-[9px] text-slate-400">
                              {h.date.slice(5).replace("-", "/")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
