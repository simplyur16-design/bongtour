"use client";

import { useCallback, useEffect, useState } from "react";

type ApiPayload = {
  code: string;
  share_url: string;
  total_invited: number;
  total_rewarded: number;
  inviter_template: { discount_value: string; validity_days: number | null };
  invitee_template: { discount_value: string; validity_days: number | null };
};

function nfKrwFromString(s: string): string {
  const n = Number.parseInt(String(s).replace(/[^\d.-]/g, ""), 10);
  if (!Number.isFinite(n)) return new Intl.NumberFormat("ko-KR").format(0);
  return new Intl.NumberFormat("ko-KR").format(n);
}

export default function ReferralClient() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/bongsim/mypage/referral", { method: "GET" });
        const j = (await res.json().catch(() => ({}))) as ApiPayload & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setData(null);
          setErr(j.error === "unauthorized" ? "로그인이 필요합니다." : "정보를 불러오지 못했습니다.");
          return;
        }
        setData(j);
      } catch {
        if (!cancelled) {
          setData(null);
          setErr("네트워크 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copyCode = useCallback(async () => {
    if (!data?.code) return;
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [data?.code]);

  const copyUrl = useCallback(async () => {
    if (!data?.share_url) return;
    try {
      await navigator.clipboard.writeText(data.share_url);
    } catch {
      /* ignore */
    }
  }, [data?.share_url]);

  const shareKakao = useCallback(async () => {
    if (!data) return;
    const text = `봉투어 친구 초대 — 내 코드 ${data.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "봉투어", text, url: data.share_url });
        return;
      }
    } catch {
      /* user cancelled or unsupported */
    }
    const kakao = `https://story.kakao.com/share?url=${encodeURIComponent(data.share_url)}`;
    window.open(kakao, "_blank", "noopener,noreferrer");
  }, [data]);

  if (loading) {
    return <p className="text-sm text-slate-600">불러오는 중…</p>;
  }
  if (err || !data) {
    return <p className="text-sm text-red-600">{err ?? "오류가 발생했습니다."}</p>;
  }

  const invAmt = nfKrwFromString(data.inviter_template.discount_value);
  const invAmtee = nfKrwFromString(data.invitee_template.discount_value);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">친구 초대</h1>
        <p className="mt-1 text-sm text-slate-600">친구에게 코드를 공유하고, 함께 혜택을 받아 보세요.</p>
      </div>

      <section className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-teal-800/70">내 추천 코드</p>
        <p className="mt-2 break-all font-mono text-3xl font-bold tracking-wide text-slate-900">{data.code}</p>
        <button
          type="button"
          onClick={() => void copyCode()}
          className="mt-4 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
        >
          {copied ? "복사됨" : "코드 복사"}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6">
        <p className="text-xs font-medium text-slate-500">공유 링크</p>
        <p className="mt-2 break-all text-sm text-slate-800">{data.share_url}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyUrl()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            링크 복사
          </button>
          <button
            type="button"
            onClick={() => void shareKakao()}
            className="rounded-xl bg-[#FEE500] px-4 py-2 text-sm font-semibold text-[#3C1E1E] hover:brightness-95"
          >
            카카오톡으로 공유
          </button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">초대한 친구 수</p>
          <p className="mt-1 text-3xl font-bold text-teal-700">{data.total_invited}</p>
        </div>
        <div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">보상 받은 수</p>
          <p className="mt-1 text-3xl font-bold text-teal-700">{data.total_rewarded}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-amber-100 bg-amber-50/90 p-5 text-sm leading-relaxed text-amber-950">
        <p className="font-semibold">안내</p>
        <p className="mt-2">
          친구가 가입하면 친구도 즉시 <strong>{invAmtee}원</strong>, 친구 첫 결제 후 나도{" "}
          <strong>{invAmt}원</strong> 혜택이 적용될 수 있습니다. (실제 금액은 운영 정책·쿠폰 설정에 따릅니다.)
        </p>
      </section>
    </div>
  );
}
