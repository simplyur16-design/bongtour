"use client";

/**
 * REGRESSION-FREEZE[bongsim-esim-multi-qty-qr]: multi eSIM install UI — manifest
 */
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

function ManualInstallField({ label, value, copyLabel }: { label: string; value: string; copyLabel: string }) {
  return (
    <div className="mt-3">
      <p className="text-[12px] font-medium text-slate-600">{label}</p>
      <p className="mt-1 break-all rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800">
        {value}
      </p>
      <CopyButton text={value} label={copyLabel} />
    </div>
  );
}

function SingleInstallCard({
  install,
  heading,
}: {
  install: BongsimOrderPublicEsimInstallV1;
  heading: string;
}) {
  const hasManualFields = Boolean(install.sm_dp_plus_address || install.activation_code);

  return (
    <div className="rounded-xl border border-teal-100 bg-slate-50/80 p-4">
      <h3 className="text-[13px] font-semibold text-slate-900">{heading}</h3>
      {install.qr_image_url ? (
        <div className="mt-3 flex flex-col items-center rounded-xl border border-slate-100 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- 공급사 QR PNG URL */}
          <img
            src={install.qr_image_url}
            alt={`${heading} QR 코드`}
            className="max-h-[240px] w-full max-w-[240px] object-contain"
            loading="eager"
            decoding="async"
          />
        </div>
      ) : null}

      {hasManualFields ? (
        <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50/40 p-3">
          <p className="text-[12px] font-semibold text-teal-900">수동 설치</p>
          {install.sm_dp_plus_address ? (
            <ManualInstallField
              label="SM-DP+ 주소"
              value={install.sm_dp_plus_address}
              copyLabel="주소 복사"
            />
          ) : null}
          {install.activation_code ? (
            <ManualInstallField label="활성화 코드" value={install.activation_code} copyLabel="코드 복사" />
          ) : null}
        </div>
      ) : null}

      {install.apple_quick_install_url || install.android_quick_install_url ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {install.apple_quick_install_url ? (
            <a
              href={install.apple_quick_install_url}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-[13px] font-semibold text-white hover:bg-slate-800"
            >
              iPhone에서 바로 설치
            </a>
          ) : null}
          {install.android_quick_install_url ? (
            <a
              href={install.android_quick_install_url}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-900 hover:bg-slate-50"
            >
              Galaxy·Android에서 바로 설치
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function EsimInstallSection({
  install,
  installs,
}: {
  install: BongsimOrderPublicEsimInstallV1;
  installs?: BongsimOrderPublicEsimInstallV1[];
}) {
  const list =
    installs && installs.length > 0
      ? installs
      : [install];
  const readyList = list.filter(
    (x) =>
      x.ready &&
      (x.qr_image_url ||
        x.sm_dp_plus_address ||
        x.activation_code ||
        x.apple_quick_install_url ||
        x.android_quick_install_url),
  );
  const anyRevoked = list.some((x) => x.revoked) || install.revoked;

  if (anyRevoked && readyList.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-[13px] font-semibold text-slate-800">eSIM 설치</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
          주문이 취소(환불)되어 QR·문자로 받은 eSIM은 더 이상 설치·사용할 수 없습니다.
        </p>
      </section>
    );
  }

  if (readyList.length === 0) {
    const hasPending = list.length > 0;
    return (
      <section
        className={`rounded-2xl border border-dashed p-4 ${
          hasPending ? "border-amber-200 bg-amber-50/80" : "border-slate-300 bg-slate-50"
        }`}
      >
        <h2 className="text-[13px] font-semibold text-slate-800">eSIM 설치</h2>
        <p className={`mt-2 text-[12px] ${hasPending ? "text-amber-900" : "text-slate-500"}`}>
          {hasPending
            ? "발급 처리 중입니다. 잠시 후 새로고침해 주세요."
            : "QR 코드는 발급 완료 후 표시됩니다."}
        </p>
      </section>
    );
  }

  const multi = readyList.length > 1 || (readyList[0]?.unit_total ?? 0) > 1;

  return (
    <section className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
      <h2 className="text-[14px] font-semibold text-slate-900">eSIM 설치</h2>
      <p className="mt-1 text-[12px] text-slate-600">
        {multi
          ? `이 주문에는 eSIM ${readyList.length}개가 포함되어 있습니다. 각각 QR 또는 바로 설치로 진행해 주세요.`
          : "아래 QR·바로 설치로 진행하세요. (설정 → 셀룰러/모바일 네트워크 → eSIM 추가)"}
      </p>

      <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5" role="note">
        <p className="text-[12px] font-semibold text-amber-950">설치 전 30초 체크</p>
        <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-amber-900/95">
          <li>해외에서는 국내 유심 데이터 로밍 OFF · 데이터는 eSIM만 (요금 폭탄 방지)</li>
          <li>QR·설치코드는 1회성 — 여행 끝나기 전 삭제하지 마세요</li>
          <li>상세 단계: /travel/esim/guide (iPhone · Android)</li>
        </ul>
      </div>

      <div className="mt-4 space-y-4">
        {readyList.map((item, i) => {
          const idx = item.unit_index ?? i + 1;
          const total = item.unit_total ?? readyList.length;
          const heading = multi ? `eSIM ${idx}/${total}` : "eSIM QR";
          return (
            <SingleInstallCard
              key={item.topup_row_id ?? `${idx}-${item.qr_image_url ?? ""}`}
              install={item}
              heading={heading}
            />
          );
        })}
      </div>
    </section>
  );
}
