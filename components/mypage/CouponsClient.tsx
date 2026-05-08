"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Tab = "active" | "used" | "expired";

type CouponRow = {
  user_coupon_id: string;
  template_label: string;
  discount_type: string;
  discount_value: string;
  max_discount_krw: string | null;
  min_order_krw: string | null;
  expires_at: string | null;
  status: string;
  used_at: string | null;
};

type ApiPayload = {
  active: CouponRow[];
  used: CouponRow[];
  expired: CouponRow[];
};

function nfKrw(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.max(0, Math.trunc(n)));
}

function discountLine(r: CouponRow): string {
  const dtype = String(r.discount_type).trim().toLowerCase();
  const dv = Number(r.discount_value);
  if (dtype === "percent" && Number.isFinite(dv)) {
    return `${dv}% 할인`;
  }
  if (dtype === "fixed" && Number.isFinite(dv)) {
    return `${nfKrw(dv)}원 할인`;
  }
  return "할인";
}

function minOrderLine(r: CouponRow): string | null {
  const raw = r.min_order_krw;
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `최소 주문 ${nfKrw(n)}원 이상`;
}

function ddayLabel(expiresAt: string | null, now: Date): { text: string; urgent: boolean } {
  if (!expiresAt) return { text: "만료일 없음", urgent: false };
  const end = new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return { text: "", urgent: false };
  const ms = end.getTime() - now.getTime();
  const days = Math.ceil(ms / 86_400_000);
  if (days < 0) return { text: "만료됨", urgent: false };
  if (days === 0) return { text: "D-day", urgent: true };
  return { text: `D-${days}`, urgent: days <= 3 };
}

export default function CouponsClient() {
  const [tab, setTab] = useState<Tab>("active");
  const [data, setData] = useState<ApiPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/bongsim/mypage/coupons", { method: "GET" });
      const j = (await res.json().catch(() => ({}))) as ApiPayload & { error?: string };
      if (!res.ok) {
        setData(null);
        setErr(j.error === "unauthorized" ? "로그인이 필요합니다." : "쿠폰을 불러오지 못했습니다.");
        return;
      }
      setData({ active: j.active ?? [], used: j.used ?? [], expired: j.expired ?? [] });
    } catch {
      setData(null);
      setErr("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = !data ? [] : tab === "active" ? data.active : tab === "used" ? data.used : data.expired;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">내 쿠폰함</h1>
        <p className="mt-1 text-sm text-slate-600">사용 가능한 할인권을 확인하고 결제 시 적용할 수 있습니다.</p>
      </div>

      <div className="flex gap-1 rounded-xl border border-teal-100 bg-white/80 p-1 shadow-sm">
        {(
          [
            ["active", "사용가능"],
            ["used", "사용완료"],
            ["expired", "만료됨"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === k ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-teal-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-slate-600">불러오는 중…</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {!loading && !err && data && rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/40 p-8 text-center text-sm text-slate-700">
          <p>아직 표시할 쿠폰이 없습니다.</p>
          <p className="mt-3">
            추천인 코드를 입력하면 즉시{" "}
            <Link href="/mypage/referral" className="font-semibold text-teal-700 underline underline-offset-2">
              5,000원
            </Link>
            <span className="whitespace-nowrap"> 혜택이 있을 수 있어요 →</span>
          </p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {rows.map((r) => {
          const dd = ddayLabel(r.expires_at, now);
          const minL = minOrderLine(r);
          return (
            <li
              key={r.user_coupon_id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-slate-900">{r.template_label}</p>
                {r.expires_at ? (
                  <span className={`text-xs font-semibold ${dd.urgent ? "text-red-600" : "text-slate-500"}`}>
                    {dd.text}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-lg font-bold text-teal-700">{discountLine(r)}</p>
              {minL ? <p className="mt-1 text-xs text-slate-500">{minL}</p> : null}
              {r.used_at ? (
                <p className="mt-2 text-xs text-slate-400">사용일 {new Date(r.used_at).toLocaleString("ko-KR")}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
