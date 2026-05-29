"use client";

import { useState } from "react";
import {
  CMLINK_TRAVELER_VERIFICATION_URL,
  TRAVELER_VERIFICATION_ICCID_PREFIX,
  extractIccidPostPrefix,
} from "@/lib/bongsim/esim/iccid-verification";

type Props = {
  iccid: string;
};

export function EsimTravelerVerificationCallout({ iccid }: Props) {
  const postPrefix = extractIccidPostPrefix(iccid);
  const [copied, setCopied] = useState(false);

  if (!postPrefix) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(postPrefix);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-slate-900">이 eSIM은 사용 전 여행자 인증이 필요합니다</p>
      <p className="mt-1 text-xs text-slate-600">
        아래 ICCID 뒷부분을 복사해 CMLink에서 인증을 완료해 주세요.
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
        <p className="min-w-0 flex-1 break-all font-mono text-sm leading-relaxed">
          <span className="text-slate-400">{TRAVELER_VERIFICATION_ICCID_PREFIX}</span>
          <span className="font-bold text-slate-900">{postPrefix}</span>
        </p>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          aria-live="polite"
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      <a
        href={CMLINK_TRAVELER_VERIFICATION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex w-full items-center justify-center rounded-xl bg-[#1F1B2D] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2a2540]"
      >
        CMLink에서 인증하기 →
      </a>
    </div>
  );
}
