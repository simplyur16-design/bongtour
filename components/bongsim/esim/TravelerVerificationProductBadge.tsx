"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleHelp, ShieldAlert, ShieldCheck } from "lucide-react";
import type { KycBadgeState } from "@/lib/bongsim/esim/kyc-required";
import { EsimVerificationGuideModal } from "@/components/bongsim/esim/EsimVerificationGuideModal";
import { bongsimPath } from "@/lib/bongsim/constants";

type Props = {
  state: KycBadgeState;
  className?: string;
  size?: "sm" | "md";
  /** true: amber 배지 옆 (?) → 인증 안내 모달 */
  showHelpIcon?: boolean;
};

export function TravelerVerificationProductBadge({
  state,
  className = "",
  size = "sm",
  showHelpIcon = false,
}: Props) {
  const [guideOpen, setGuideOpen] = useState(false);

  if (state == null) return null;

  const sizeClass =
    size === "md" ? "text-xs py-1 px-2" : "text-[10px] py-0.5 px-1.5";
  const iconClass = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  const helpIconClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  if (state === "required") {
    return (
      <>
        <span className={`inline-flex items-center gap-1 ${className}`}>
          <span
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-amber-200 bg-amber-100 font-semibold text-amber-800 ${sizeClass}`}
          >
            <ShieldAlert className={iconClass} aria-hidden />
            여행자 인증 필요
          </span>
          {showHelpIcon ? (
            <>
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="inline-flex shrink-0 items-center justify-center rounded-full text-amber-700 transition hover:bg-amber-100 hover:text-amber-900"
                aria-label="여행자 인증 안내"
              >
                <CircleHelp className={helpIconClass} aria-hidden />
              </button>
              <Link
                href={bongsimPath("/benefits/traveler-verification")}
                className="text-[10px] font-semibold text-amber-800 underline underline-offset-2"
              >
                더보기
              </Link>
            </>
          ) : null}
        </span>
        {showHelpIcon ? (
          <EsimVerificationGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
        ) : null}
      </>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-teal-200 bg-teal-100 font-semibold text-teal-800 ${sizeClass} ${className}`}
    >
      <ShieldCheck className={iconClass} aria-hidden />
      인증 필요없음
    </span>
  );
}
