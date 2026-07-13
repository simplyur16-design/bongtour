"use client";

import Link from "next/link";
import { bongsimPath } from "@/lib/bongsim/constants";
import { CMLINK_TRAVELER_VERIFICATION_URL } from "@/lib/bongsim/esim/iccid-verification";
import type { TravelerVerificationCountryPolicy } from "@/lib/bongsim/data/list-country-catalog-meta";

type CountryEntry = {
  code: string;
  nameKr: string;
  policy: TravelerVerificationCountryPolicy;
};

type Props = {
  countries: CountryEntry[];
};

/** 선택 국가 중 여행자 인증 대상만 — flags.kyc SSOT 기반 */
export function CountryTravelerVerificationNotice({ countries }: Props) {
  const relevant = countries.filter((c) => c.policy === "required" || c.policy === "mixed");
  if (relevant.length === 0) return null;

  const requiredOnly = relevant.filter((c) => c.policy === "required");
  const mixed = relevant.filter((c) => c.policy === "mixed");

  return (
    <div className="space-y-2" aria-label="여행자 인증 국가 안내">
      {requiredOnly.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-[13px] font-semibold text-amber-950">
            여행자 인증 필요: {requiredOnly.map((c) => c.nameKr).join(", ")}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-amber-900/90">
            이 국가 eSIM은 CMLink 여행자 인증(여권) 후 사용할 수 있습니다. 대상은 홍콩·마카오·대만이며
            중국 본토·일본·베트남 등은 인증이 필요 없습니다.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={bongsimPath("/benefits/traveler-verification")}
              className="inline-flex min-h-8 items-center rounded-lg border border-amber-300 bg-white px-2.5 text-[11px] font-semibold text-amber-950"
            >
              인증 방법 더보기
            </Link>
            <a
              href={CMLINK_TRAVELER_VERIFICATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-8 items-center rounded-lg bg-[#1F1B2D] px-2.5 text-[11px] font-semibold text-white"
            >
              CMLink →
            </a>
          </div>
        </div>
      ) : null}
      {mixed.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[13px] font-semibold text-slate-800">
            일부 플랜만 인증 필요: {mixed.map((c) => c.nameKr).join(", ")}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
            「여행자 인증 필요」 표시가 있는 플랜만 CMLink 인증 대상입니다. 인증 없이 쓸 수 있는
            플랜도 함께 있습니다.
          </p>
        </div>
      ) : null}
    </div>
  );
}
