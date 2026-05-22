"use client";

import type { BongsimOrderPublicEsimInstallV1 } from "@/lib/bongsim/contracts/order-public.v1";
import { useState } from "react";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
    >
      {copied ? "복사됨" : label}
    </button>
  );
}

export function EsimInstallSection({ install }: { install: BongsimOrderPublicEsimInstallV1 }) {
  if (!install.ready && !install.qr_image_url && !install.manual_install_code) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <h2 className="text-[13px] font-semibold text-slate-800">eSIM 설치</h2>
        <p className="mt-2 text-[12px] text-slate-500">QR 코드는 발급 완료 후 표시됩니다.</p>
      </section>
    );
  }

  if (!install.ready) {
    return (
      <section className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/80 p-4">
        <h2 className="text-[13px] font-semibold text-amber-950">eSIM 설치</h2>
        <p className="mt-2 text-[12px] text-amber-900">발급 처리 중입니다. 잠시 후 새로고침해 주세요.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
      <h2 className="text-[14px] font-semibold text-slate-900">eSIM 설치</h2>
      <p className="mt-1 text-[12px] text-slate-600">설정 → 셀룰러 → eSIM 추가에서 아래 QR을 스캔해 주세요.</p>

      {install.qr_image_url ? (
        <div className="mt-4 flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- 공급사 QR PNG URL */}
          <img
            src={install.qr_image_url}
            alt="eSIM 설치 QR 코드"
            className="max-h-[280px] w-full max-w-[280px] object-contain"
            loading="eager"
            decoding="async"
          />
        </div>
      ) : null}

      {install.manual_install_code ? (
        <div className="mt-4">
          <p className="text-[12px] font-medium text-slate-600">수동 설치 코드</p>
          <p className="mt-1 break-all rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800">
            {install.manual_install_code}
          </p>
          <CopyButton text={install.manual_install_code} label="코드 복사" />
        </div>
      ) : null}

      {install.apple_quick_install_url ? (
        <a
          href={install.apple_quick_install_url}
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-[13px] font-semibold text-white hover:bg-slate-800"
        >
          iPhone에서 바로 설치
        </a>
      ) : null}
    </section>
  );
}
