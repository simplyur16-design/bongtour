"use client";

import { useCallback, useEffect, useState } from "react";

type CouponRow = {
  coupon_id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: string;
  max_discount_krw: string | null;
  min_order_krw: string | null;
  usage_limit: string | number | null;
  used_count: string | number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
};

export default function CouponsAdminClient() {
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [discountValue, setDiscountValue] = useState("1000");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [minOrder, setMinOrder] = useState("0");
  const [usageLimit, setUsageLimit] = useState("");
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const res = await fetch("/api/admin/bongsim/coupons", { cache: "no-store" });
      const j = (await res.json()) as { coupons?: CouponRow[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? "목록을 불러오지 못했습니다.");
      setRows(j.coupons ?? []);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "오류");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createCoupon = async () => {
    setBusy(true);
    setLoadErr(null);
    try {
      const res = await fetch("/api/admin/bongsim/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim() || undefined,
          description: description.trim(),
          discount_type: discountType,
          discount_value: Number.parseFloat(discountValue),
          max_discount_krw: maxDiscount.trim() ? Number.parseInt(maxDiscount, 10) : null,
          min_order_krw: minOrder.trim() ? Number.parseInt(minOrder, 10) : 0,
          usage_limit: usageLimit.trim() ? Number.parseInt(usageLimit, 10) : null,
          valid_from: `${validFrom}T00:00:00.000Z`,
          valid_until: `${validUntil}T23:59:59.999Z`,
          is_active: true,
        }),
      });
      const j = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) throw new Error(j.error ?? "생성 실패");
      setCode("");
      setDescription("");
      await load();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: string, next: boolean) => {
    try {
      const res = await fetch(`/api/admin/bongsim/coupons/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "변경 실패");
      }
      await load();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "오류");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">봉심 쿠폰</h1>
        <p className="mt-1 text-sm text-slate-400">코드·할인·기간·사용 한도를 관리합니다.</p>
      </div>

      {loadErr ? (
        <div className="rounded-lg border border-red-400/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{loadErr}</div>
      ) : null}

      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-slate-100">쿠폰 생성</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-400">코드 (비우면 자동)</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">설명</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">할인 유형</span>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "fixed" | "percent")}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            >
              <option value="fixed">정액 (원)</option>
              <option value="percent">정률 (%)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">할인값 {discountType === "percent" ? "(%)" : "(원)"}</span>
            <input
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">최대 할인 (원, 정률만)</span>
            <input
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">최소 주문 (원)</span>
            <input
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">사용 한도 (비우면 무제한)</span>
            <input
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">시작일 (UTC)</span>
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">종료일 (UTC)</span>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void createCoupon()}
          className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
        >
          생성
        </button>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-slate-100">목록</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="py-2 pr-3">코드</th>
                <th className="py-2 pr-3">설명</th>
                <th className="py-2 pr-3">할인</th>
                <th className="py-2 pr-3">사용</th>
                <th className="py-2 pr-3">기간</th>
                <th className="py-2">활성</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.coupon_id} className="border-b border-slate-800">
                  <td className="py-2 pr-3 font-mono text-teal-300">{r.code}</td>
                  <td className="max-w-[12rem] truncate py-2 pr-3">{r.description ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {r.discount_type === "percent" ? `${r.discount_value}%` : `${Number(r.discount_value).toLocaleString()}원`}
                  </td>
                  <td className="py-2 pr-3">
                    {String(r.used_count)} / {r.usage_limit == null ? "∞" : String(r.usage_limit)}
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-400">
                    {new Date(r.valid_from).toLocaleDateString("ko-KR")} ~ {new Date(r.valid_until).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => void toggle(r.coupon_id, !r.is_active)}
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${
                        r.is_active ? "bg-emerald-900 text-emerald-200" : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {r.is_active ? "ON" : "OFF"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="mt-4 text-sm text-slate-500">등록된 쿠폰이 없습니다.</p> : null}
        </div>
      </section>
    </div>
  );
}
