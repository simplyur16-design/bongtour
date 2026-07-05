"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CMLINK_TRAVELER_VERIFICATION_URL,
  TRAVELER_VERIFICATION_ICCID_PREFIX,
  extractIccidPostPrefix,
} from "@/lib/bongsim/esim/iccid-verification";
import { bongsimPath } from "@/lib/bongsim/constants";
import { EsimVerificationGuideContent } from "@/components/bongsim/esim/EsimVerificationGuideContent";

type Props = {
  iccid: string;
};

export function EsimTravelerVerificationCallout({ iccid }: Props) {
  const postPrefix = extractIccidPostPrefix(iccid);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
        ICCID 뒷 12자리를 CMLink에 입력해 인증을 완료해 주세요.
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
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={CMLINK_TRAVELER_VERIFICATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#1F1B2D] px-4 text-sm font-semibold text-white transition hover:bg-[#2a2540]"
        >
          CMLink에서 인증하기 →
        </a>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950 hover:bg-amber-100/80"
          aria-expanded={expanded}
        >
          {expanded ? "접기" : "더보기"}
        </button>
      </div>
      {expanded ? (
        <div className="mt-4 space-y-3 border-t border-amber-200 pt-4">
          <EsimVerificationGuideContent />
          <Link
            href={bongsimPath("/benefits/traveler-verification")}
            className="inline-flex text-[13px] font-semibold text-teal-800 underline underline-offset-2"
          >
            여행자 인증 안내 페이지 →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
