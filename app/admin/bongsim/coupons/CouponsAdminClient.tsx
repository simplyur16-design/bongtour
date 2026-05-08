"use client";

import { useCallback, useEffect, useState } from "react";

type CouponKindTab = "all" | "public_code" | "issuance_template";

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
  coupon_kind: string;
  template_label: string | null;
  template_validity_days: number | null;
};

/** 템플릿 코드 → 자동발급 슬롯 표시 — 서버 issuance-helpers 와 동기화 */
const TEMPLATE_CODE_SLOT: Record<string, string> = {
  __TPL_WELCOME_BONUS: "welcome",
  __TPL_REVIEW_REWARD: "review",
  __TPL_REFERRAL_INVITER: "referral_inviter",
  __TPL_REFERRAL_INVITEE: "referral_invitee",
};

function slotIndicator(code: string): string | null {
  if (TEMPLATE_CODE_SLOT[code]) return TEMPLATE_CODE_SLOT[code];
  if (code.startsWith("__TPL_")) return "system";
  return null;
}

export default function CouponsAdminClient() {
  const [tab, setTab] = useState<CouponKindTab>("all");
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState("");
  const [couponKindCreate, setCouponKindCreate] = useState<"public_code" | "issuance_template">("public_code");
  const [templateLabel, setTemplateLabel] = useState("");
  const [templateValidityDays, setTemplateValidityDays] = useState("30");
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

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<CouponRow | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editDiscountValue, setEditDiscountValue] = useState("");
  const [editMaxDiscount, setEditMaxDiscount] = useState("");
  const [editMinOrder, setEditMinOrder] = useState("");
  const [editValidUntil, setEditValidUntil] = useState("");

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkCount, setBulkCount] = useState("10");
  const [bulkCodes, setBulkCodes] = useState<string[]>([]);

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueEmail, setIssueEmail] = useState("");
  const [issueTemplateCode, setIssueTemplateCode] = useState("");
  const [issueNotes, setIssueNotes] = useState("");
  const [issueIssuedVia, setIssueIssuedVia] = useState<
    "admin_manual" | "welcome" | "review" | "referral_inviter" | "referral_invitee"
  >("admin_manual");

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const q = tab === "all" ? "" : `?kind=${encodeURIComponent(tab)}`;
      const res = await fetch(`/api/admin/bongsim/coupons${q}`, { cache: "no-store" });
      const j = (await res.json()) as { coupons?: CouponRow[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? "목록을 불러오지 못했습니다.");
      setRows(j.coupons ?? []);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "오류");
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const [issueTplRows, setIssueTplRows] = useState<CouponRow[]>([]);

  useEffect(() => {
    if (!issueOpen) return;
    void (async () => {
      try {
        const res = await fetch("/api/admin/bongsim/coupons?kind=issuance_template", { cache: "no-store" });
        const j = (await res.json()) as { coupons?: CouponRow[] };
        if (res.ok) setIssueTplRows(j.coupons ?? []);
      } catch {
        setIssueTplRows([]);
      }
    })();
  }, [issueOpen]);

  const createCoupon = async () => {
    setBusy(true);
    setLoadErr(null);
    try {
      const res = await fetch("/api/admin/bongsim/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim() || undefined,
          coupon_kind: couponKindCreate,
          template_label: couponKindCreate === "issuance_template" ? templateLabel.trim() : undefined,
          template_validity_days:
            couponKindCreate === "issuance_template" && templateValidityDays.trim()
              ? Number.parseInt(templateValidityDays, 10)
              : null,
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
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "생성 실패");
      setCode("");
      setDescription("");
      setTemplateLabel("");
      await load();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  const patchCoupon = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/bongsim/coupons/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(j.error ?? "변경 실패");
  };

  const toggle = async (id: string, next: boolean) => {
    try {
      await patchCoupon(id, { is_active: next });
      await load();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "오류");
    }
  };

  const openEdit = (r: CouponRow) => {
    setEditRow(r);
    setEditDescription(r.description ?? "");
    setEditDiscountValue(String(r.discount_value));
    setEditMaxDiscount(r.max_discount_krw != null ? String(r.max_discount_krw) : "");
    setEditMinOrder(r.min_order_krw != null ? String(r.min_order_krw) : "0");
    setEditValidUntil(new Date(r.valid_until).toISOString().slice(0, 10));
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setBusy(true);
    setLoadErr(null);
    try {
      const used = typeof editRow.used_count === "string" ? Number.parseInt(editRow.used_count, 10) : Number(editRow.used_count);
      const body: Record<string, unknown> = {
        description: editDescription.trim(),
        min_order_krw: editMinOrder.trim() ? Number.parseInt(editMinOrder, 10) : 0,
        valid_until: `${editValidUntil}T23:59:59.999Z`,
      };
      if (!Number.isFinite(used) || used <= 0) {
        body.discount_value = Number.parseFloat(editDiscountValue);
        body.max_discount_krw = editMaxDiscount.trim() ? Number.parseInt(editMaxDiscount, 10) : null;
      }
      await patchCoupon(editRow.coupon_id, body);
      setEditOpen(false);
      setEditRow(null);
      await load();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("이 쿠폰을 삭제할까요? 사용자 발급 이력이 있으면 삭제되지 않을 수 있습니다.")) return;
    try {
      const res = await fetch(`/api/admin/bongsim/coupons/${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "삭제 실패");
      await load();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "오류");
    }
  };

  const runBulk = async () => {
    setBusy(true);
    setLoadErr(null);
    setBulkCodes([]);
    try {
      const res = await fetch("/api/admin/bongsim/coupons/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix: bulkPrefix.trim(),
          count: Number.parseInt(bulkCount, 10),
          template: {
            discount_type: discountType,
            discount_value: Number.parseFloat(discountValue),
            max_discount_krw: maxDiscount.trim() ? Number.parseInt(maxDiscount, 10) : null,
            min_order_krw: minOrder.trim() ? Number.parseInt(minOrder, 10) : 0,
            usage_limit: usageLimit.trim() ? Number.parseInt(usageLimit, 10) : null,
            valid_from: `${validFrom}T00:00:00.000Z`,
            valid_until: `${validUntil}T23:59:59.999Z`,
            description: description.trim() || null,
          },
        }),
      });
      const j = (await res.json()) as { error?: string; codes?: string[] };
      if (!res.ok) throw new Error(j.error ?? "벌크 생성 실패");
      setBulkCodes(j.codes ?? []);
      await load();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  const downloadBulkCsv = () => {
    if (bulkCodes.length === 0) return;
    const blob = new Blob([["code", ...bulkCodes].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bongsim-coupons-${bulkPrefix}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runIssue = async () => {
    setBusy(true);
    setLoadErr(null);
    try {
      const res = await fetch("/api/admin/bongsim/user-coupons/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: issueEmail.trim(),
          issuedVia: issueIssuedVia,
          ...(issueIssuedVia === "admin_manual" ? { sourceCouponCode: issueTemplateCode.trim() } : {}),
          notes: issueNotes.trim() || undefined,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "발급 실패");
      setIssueOpen(false);
      setIssueEmail("");
      setIssueTemplateCode("");
      setIssueNotes("");
      await load();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  const systemTemplate = (code: string) => code.startsWith("__TPL_");
  const usedNum = (r: CouponRow) =>
    typeof r.used_count === "string" ? Number.parseInt(r.used_count, 10) || 0 : Math.trunc(Number(r.used_count)) || 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">봉심 쿠폰</h1>
          <p className="mt-1 text-sm text-slate-400">코드·할인·기간·템플릿·벌크·수동 발급을 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
          >
            벌크 생성
          </button>
          <button
            type="button"
            onClick={() => setIssueOpen(true)}
            className="rounded-lg border border-teal-700 bg-teal-950/50 px-3 py-2 text-sm font-semibold text-teal-200 hover:bg-teal-900/50"
          >
            사용자에게 발급
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-2">
        {(
          [
            ["all", "전체"],
            ["public_code", "공개 코드"],
            ["issuance_template", "발급 템플릿"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === k ? "bg-teal-700 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loadErr ? (
        <div className="rounded-lg border border-red-400/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{loadErr}</div>
      ) : null}

      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-slate-100">쿠폰 생성</h2>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="radio"
              checked={couponKindCreate === "public_code"}
              onChange={() => setCouponKindCreate("public_code")}
            />
            공개 코드 (public_code)
          </label>
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="radio"
              checked={couponKindCreate === "issuance_template"}
              onChange={() => setCouponKindCreate("issuance_template")}
            />
            발급 템플릿 (issuance_template)
          </label>
        </div>
        {couponKindCreate === "issuance_template" ? (
          <p className="mt-2 text-xs text-amber-200/90">
            시스템 예약 코드(<span className="font-mono">__TPL_*</span>)는 생성할 수 없습니다. 비활성화 시 해당 템플릿으로의 자동 발급이 멈춥니다.
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-400">코드 (비우면 자동)</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={couponKindCreate === "issuance_template" ? "비우면 자동 ( __TPL_ 접두어 불가 )" : ""}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          {couponKindCreate === "issuance_template" ? (
            <>
              <label className="block text-sm">
                <span className="text-slate-400">템플릿 라벨 *</span>
                <input
                  value={templateLabel}
                  onChange={(e) => setTemplateLabel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">유효 일수 (비우면 무제한에 가깝게 NULL)</span>
                <input
                  value={templateValidityDays}
                  onChange={(e) => setTemplateValidityDays(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
                />
              </label>
            </>
          ) : null}
          <label className="block text-sm sm:col-span-2">
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
                <th className="py-2 pr-3">종류</th>
                <th className="py-2 pr-3">템플릿·슬롯</th>
                <th className="py-2 pr-3">설명</th>
                <th className="py-2 pr-3">할인</th>
                <th className="py-2 pr-3">사용</th>
                <th className="py-2 pr-3">기간</th>
                <th className="py-2 pr-3">편집</th>
                <th className="py-2">활성</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sl = r.coupon_kind === "issuance_template" ? slotIndicator(r.code) : null;
                return (
                  <tr key={r.coupon_id} className="border-b border-slate-800">
                    <td className="py-2 pr-3 font-mono text-teal-300">{r.code}</td>
                    <td className="py-2 pr-3 text-xs">
                      {r.coupon_kind === "issuance_template" ? (
                        <span className="rounded bg-violet-900/60 px-1.5 py-0.5 text-violet-200">템플릿</span>
                      ) : (
                        <span className="rounded bg-slate-700 px-1.5 py-0.5 text-slate-300">공개</span>
                      )}
                    </td>
                    <td className="max-w-[14rem] py-2 pr-3 align-top text-xs text-slate-400">
                      {r.coupon_kind === "issuance_template" ? (
                        <>
                          <div className="font-medium text-slate-200">{r.template_label ?? "—"}</div>
                          <div>유효 {r.template_validity_days != null ? `${r.template_validity_days}일` : "—"}</div>
                          {sl ? (
                            <div className="mt-1 text-teal-400/90">
                              자동발급 슬롯: <span className="font-mono">{sl}</span>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-[10rem] truncate py-2 pr-3">{r.description ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {r.discount_type === "percent" ? `${r.discount_value}%` : `${Number(r.discount_value).toLocaleString()}원`}
                    </td>
                    <td className="py-2 pr-3">
                      {String(r.used_count)} / {r.usage_limit == null ? "∞" : String(r.usage_limit)}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-400">
                      {new Date(r.valid_from).toLocaleDateString("ko-KR")} ~ {new Date(r.valid_until).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="rounded-md bg-slate-700 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-600"
                        >
                          수정
                        </button>
                        {!systemTemplate(r.code) ? (
                          <button
                            type="button"
                            onClick={() => void deleteCoupon(r.coupon_id)}
                            className="rounded-md bg-red-950/60 px-2 py-1 text-xs font-semibold text-red-200 hover:bg-red-900/60"
                          >
                            삭제
                          </button>
                        ) : null}
                      </div>
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
                      {systemTemplate(r.code) && !r.is_active ? (
                        <p className="mt-1 max-w-[8rem] text-[10px] text-amber-200/90">비활성 시 자동발급 중단</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="mt-4 text-sm text-slate-500">등록된 쿠폰이 없습니다.</p> : null}
        </div>
      </section>

      {editOpen && editRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-600 bg-slate-900 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-100">쿠폰 수정</h3>
            <p className="mt-1 font-mono text-sm text-teal-300">{editRow.code}</p>
            {systemTemplate(editRow.code) ? (
              <p className="mt-2 text-sm text-amber-200">시스템 템플릿은 활성 토글만 API에서 허용합니다. 여기서는 설명·금액 변경이 제한될 수 있습니다.</p>
            ) : null}
            <label className="mt-4 block text-sm">
              <span className="text-slate-400">설명</span>
              <input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={systemTemplate(editRow.code)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 disabled:opacity-50"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-400">할인값 {editRow.discount_type === "percent" ? "(%)" : "(원)"}</span>
              <input
                value={editDiscountValue}
                onChange={(e) => setEditDiscountValue(e.target.value)}
                disabled={systemTemplate(editRow.code) || usedNum(editRow) > 0}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 disabled:opacity-50"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-400">최대 할인 (원)</span>
              <input
                value={editMaxDiscount}
                onChange={(e) => setEditMaxDiscount(e.target.value)}
                disabled={systemTemplate(editRow.code) || usedNum(editRow) > 0}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 disabled:opacity-50"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-400">최소 주문 (원)</span>
              <input
                value={editMinOrder}
                onChange={(e) => setEditMinOrder(e.target.value)}
                disabled={systemTemplate(editRow.code)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 disabled:opacity-50"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-400">종료일</span>
              <input
                type="date"
                value={editValidUntil}
                onChange={(e) => setEditValidUntil(e.target.value)}
                disabled={systemTemplate(editRow.code)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 disabled:opacity-50"
              />
            </label>
            {usedNum(editRow) > 0 ? (
              <p className="mt-2 text-xs text-amber-200">사용 이력이 있어 할인값·최대 할인은 변경할 수 없습니다.</p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false);
                  setEditRow(null);
                }}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300"
              >
                닫기
              </button>
              {!systemTemplate(editRow.code) ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveEdit()}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  저장
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {bulkOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-900 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-100">벌크 공개 코드 생성</h3>
            <p className="mt-1 text-xs text-slate-400">아래 생성 폼의 할인·기간 설정을 공유합니다. 접두어는 영숫자만.</p>
            <label className="mt-4 block text-sm">
              <span className="text-slate-400">접두어</span>
              <input
                value={bulkPrefix}
                onChange={(e) => setBulkPrefix(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-slate-100"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-400">개수 (1–500)</span>
              <input
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
              />
            </label>
            {bulkCodes.length > 0 ? (
              <div className="mt-4">
                <p className="text-sm text-emerald-300">{bulkCodes.length}건 생성됨</p>
                <button
                  type="button"
                  onClick={downloadBulkCsv}
                  className="mt-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-600"
                >
                  CSV 다운로드
                </button>
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runBulk()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {issueOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-900 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-100">사용자에게 발급</h3>
            <p className="mt-1 text-xs text-slate-400">
              카카오 알림은 발송하지 않습니다. 슬롯 목록에서 <span className="font-mono">birthday</span>는 제외되어 있습니다(정책).
            </p>
            <label className="mt-4 block text-sm">
              <span className="text-slate-400">이메일</span>
              <input
                value={issueEmail}
                onChange={(e) => setIssueEmail(e.target.value)}
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-slate-400">issued_via (birthday 없음)</span>
              <select
                value={issueIssuedVia}
                onChange={(e) =>
                  setIssueIssuedVia(
                    e.target.value as "admin_manual" | "welcome" | "review" | "referral_inviter" | "referral_invitee",
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
              >
                <option value="admin_manual">admin_manual — 템플릿 코드 지정</option>
                <option value="welcome">welcome — 시스템 템플릿</option>
                <option value="review">review — 시스템 템플릿</option>
                <option value="referral_inviter">referral_inviter — 시스템 템플릿</option>
                <option value="referral_invitee">referral_invitee — 시스템 템플릿</option>
              </select>
            </label>
            {issueIssuedVia === "admin_manual" ? (
              <label className="mt-3 block text-sm">
                <span className="text-slate-400">발급 템플릿 (코드)</span>
                <select
                  value={issueTemplateCode}
                  onChange={(e) => setIssueTemplateCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
                >
                  <option value="">선택…</option>
                  {issueTplRows.map((t) => (
                    <option key={t.coupon_id} value={t.code}>
                      {t.template_label ?? t.code} ({t.code})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="mt-3 text-xs text-slate-500">선택한 슬롯의 시스템 템플릿(<span className="font-mono">__TPL_*</span>)으로 발급합니다. 중복 규칙이 있으면 발급되지 않습니다.</p>
            )}
            <label className="mt-3 block text-sm">
              <span className="text-slate-400">발급 사유 메모</span>
              <textarea
                value={issueNotes}
                onChange={(e) => setIssueNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIssueOpen(false)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runIssue()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                발급
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
