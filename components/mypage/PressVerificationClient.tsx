"use client";

import { useState } from "react";
import Link from "next/link";
import MypagePageHeading from "@/components/mypage/MypagePageHeading";
import { PRESS_ALLOWED_DOMAINS } from "@/lib/bongsim/press/press-domains";

export type PressVerificationInitial = {
  pressVerified: boolean;
  pressVerifiedAt: string | null;
  pressVerifiedDomain: string | null;
  pressVerifiedEmail: string | null;
  marketingConsent: boolean;
};

type Props = {
  initial: PressVerificationInitial;
};

function formatKst(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export default function PressVerificationClient({ initial }: Props) {
  const [verified, setVerified] = useState(initial.pressVerified);
  const [verifiedEmail, setVerifiedEmail] = useState(initial.pressVerifiedEmail);
  const [verifiedDomain, setVerifiedDomain] = useState(initial.pressVerifiedDomain);
  const [verifiedAt, setVerifiedAt] = useState(initial.pressVerifiedAt);

  const [workEmail, setWorkEmail] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState<"request" | "verify" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const allowedLabel = PRESS_ALLOWED_DOMAINS.map((d) => `@${d}`).join(", ");

  async function onRequestOtp() {
    setBusy("request");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/bongsim/mypage/press/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ work_email: workEmail }),
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        setErr(j.message ?? "인증번호를 보내지 못했습니다.");
        setOtpSent(false);
        return;
      }
      setOtpSent(true);
      setMsg("직장 이메일로 인증번호를 보냈습니다. 10분 이내에 입력해 주세요.");
    } catch {
      setErr("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function onVerify() {
    setBusy("verify");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/bongsim/mypage/press/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ work_email: workEmail, code }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        message?: string;
        ok?: boolean;
        pressVerifiedEmail?: string;
        pressVerifiedDomain?: string;
      };
      if (!res.ok) {
        setErr(j.message ?? "인증에 실패했습니다.");
        return;
      }
      setVerified(true);
      setVerifiedEmail(j.pressVerifiedEmail ?? workEmail.trim().toLowerCase());
      setVerifiedDomain(j.pressVerifiedDomain ?? null);
      setVerifiedAt(new Date().toISOString());
      setMsg("직군 인증이 완료되었습니다. eSIM 결제 시 25% 자동 할인이 적용됩니다.");
      setCode("");
    } catch {
      setErr("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  if (verified) {
    return (
      <div className="space-y-6">
        <MypagePageHeading
          title="직군(언론사) 인증"
          description="인증된 직군 회원은 eSIM 결제 시 쿠폰 없이 25% 자동 할인이 적용됩니다."
        />
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-800">인증 완료</p>
          <p className="mt-2 text-[15px] text-[#1F1B2D]">
            {verifiedEmail ? (
              <>
                <span className="font-medium">{verifiedEmail}</span>
                {verifiedDomain ? (
                  <span className="text-[#534AB7]"> (@{verifiedDomain})</span>
                ) : null}
              </>
            ) : (
              "직군 회원으로 인증되었습니다."
            )}
          </p>
          {verifiedAt ? (
            <p className="mt-1 text-sm text-[#534AB7]">인증일: {formatKst(verifiedAt)}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!initial.marketingConsent) {
    return (
      <div className="space-y-6">
        <MypagePageHeading
          title="직군(언론사) 인증"
          description="언론사 직장 이메일로 본인 확인 후 직군 할인 혜택을 받을 수 있습니다."
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-5 shadow-sm">
          <p className="text-sm font-semibold text-amber-900">마케팅 수신 동의 필요</p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#1F1B2D]">
            직군 인증은 마케팅 수신에 동의한 회원만 이용할 수 있습니다.
          </p>
          <Link
            href="/auth/signup/consent?callbackUrl=/mypage/press"
            className="mt-4 inline-block rounded-full bg-[#534AB7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4339A0]"
          >
            마케팅 동의하러 가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MypagePageHeading
        title="직군(언론사) 인증"
        description={`허용 도메인: ${allowedLabel}. 인증 후 eSIM 결제 시 25% 자동 할인(쿠폰 미적용).`}
      />

      <div className="rounded-2xl border border-[#DAD4EE] bg-white p-5 shadow-sm space-y-4">
        <div>
          <label htmlFor="press-work-email" className="block text-sm font-medium text-[#1F1B2D]">
            직장 이메일
          </label>
          <input
            id="press-work-email"
            type="email"
            autoComplete="email"
            value={workEmail}
            onChange={(e) => setWorkEmail(e.target.value)}
            placeholder={`name@${PRESS_ALLOWED_DOMAINS[0]}`}
            className="mt-1.5 w-full rounded-xl border border-[#DAD4EE] px-3 py-2.5 text-[15px] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#534AB7]/20"
          />
        </div>

        <button
          type="button"
          disabled={busy !== null || !workEmail.trim()}
          onClick={() => void onRequestOtp()}
          className="w-full rounded-xl bg-[#534AB7] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4339A0] disabled:opacity-50"
        >
          {busy === "request" ? "발송 중…" : "인증번호 받기"}
        </button>

        {otpSent ? (
          <div className="pt-2 border-t border-[#DAD4EE] space-y-3">
            <div>
              <label htmlFor="press-otp-code" className="block text-sm font-medium text-[#1F1B2D]">
                인증번호 (6자리)
              </label>
              <input
                id="press-otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1.5 w-full rounded-xl border border-[#DAD4EE] px-3 py-2.5 text-[15px] tracking-widest outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#534AB7]/20"
              />
            </div>
            <button
              type="button"
              disabled={busy !== null || code.length !== 6}
              onClick={() => void onVerify()}
              className="w-full rounded-xl border border-[#534AB7] bg-white px-4 py-2.5 text-sm font-semibold text-[#534AB7] hover:bg-[#EFEDF8] disabled:opacity-50"
            >
              {busy === "verify" ? "확인 중…" : "인증하기"}
            </button>
          </div>
        ) : null}

        {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
      </div>
    </div>
  );
}
