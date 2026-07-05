"use client";

import Link from "next/link";
import { CMLINK_TRAVELER_VERIFICATION_URL } from "@/lib/bongsim/esim/iccid-verification";
import type { KycLabelDistribution } from "@/lib/bongsim/esim/kyc-required";
import { bongsimPath } from "@/lib/bongsim/constants";

type Props = {
  distribution: KycLabelDistribution;
  compact?: boolean;
};

/**
 * flags.kyc=O 상품이 카탈로그에 있을 때만 표시.
 * 국가 공통 KYC 안내(usimsa에 없음)와 분리 — 실제 SKU 기준.
 */
export function KycPlanSelectNotice({ distribution, compact }: Props) {
  if (distribution === "none" || distribution === "not_required_only") return null;

  const isBinary = distribution === "binary";

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50/90 ${compact ? "px-3 py-2.5" : "px-3.5 py-3"}`}
      role="note"
    >
      <p className="text-[13px] font-semibold text-amber-950">
        {isBinary
          ? "선택한 플랜에 따라 여행자 인증(CMLink)이 필요할 수 있어요"
          : "이 국가 eSIM은 사용 전 여행자 인증(CMLink)이 필요합니다"}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-amber-900/90">
        {isBinary
          ? "「여행자 인증 필요」 표시가 있는 플랜만 인증 대상입니다. 인증 없이 쓸 수 있는 플랜도 함께 있어요."
          : "결제 후 ICCID를 확인한 뒤 CMLink에서 여권 인증을 완료해 주세요."}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Link
          href={bongsimPath("/benefits/traveler-verification")}
          className="inline-flex min-h-9 items-center rounded-lg border border-amber-300 bg-white px-3 text-[12px] font-semibold text-amber-950 hover:bg-amber-50"
        >
          인증 방법 더보기
        </Link>
        <a
          href={CMLINK_TRAVELER_VERIFICATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center rounded-lg bg-[#1F1B2D] px-3 text-[12px] font-semibold text-white hover:bg-[#2a2540]"
        >
          CMLink 인증 페이지 →
        </a>
      </div>
    </div>
  );
}
