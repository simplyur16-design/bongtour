"use client";

import SafeImage from "@/app/components/SafeImage";
import { CountryPurchaseNoticeList } from "@/components/bongsim/recommend/CountryPurchaseNotice";
import { DayChipPicker } from "@/components/bongsim/recommend/DayChipPicker";
import { PlanSelectPopup } from "@/components/bongsim/recommend/PlanSelectPopup";
import { TravelerVerificationProductBadge } from "@/components/bongsim/esim/TravelerVerificationProductBadge";
import { UsimsaRegionPackMetaRows } from "@/components/bongsim/recommend/UsimsaRegionPackMetaRows";
import { EsimFreeDataBenefitLine } from "@/components/bongsim/recommend/EsimFreeDataBenefitLine";
import { dateRangeFromTripDays } from "@/lib/bongsim/recommend/duration-from-days";
import {
  getKycLabelDistribution,
  shouldShowBadge,
  type KycLabelDistribution,
} from "@/lib/bongsim/esim/kyc-required";
import { isRegionPackCode, planNameForRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import { RegionPackBadgeIcon } from "@/components/bongsim/recommend/RegionPackBadgeIcon";
import { resolveDestinationFlagImageUrl } from "@/lib/bongsim/recommend/destination-flag-image";
import type { CountryOption } from "@/lib/bongsim/types";

type PlanCtx = { tripDays: number; start: Date; end: Date };

type Props = {
  code: string;
  country: CountryOption | undefined;
  availableDays: number[];
  planCtx: PlanCtx | null;
  done: boolean;
  summaryLine: string;
  selection: { product: ProductOption; quantity: number; kycDistribution?: KycLabelDistribution } | null;
  onApplyTripDays: (days: number) => void;
  onBackFromPlan: () => void;
  onCompletePlan: (
    product: ProductOption,
    quantity: number,
    ctx?: { kycDistribution?: KycLabelDistribution },
  ) => void;
  onChangeDays: () => void;
};

function flagUrl(code: string) {
  return resolveDestinationFlagImageUrl(code);
}

/** 단일 국가 — usimsa 앱형: 일수 칩 → 플랜 (달력 없음). */
export function SingleCountryPurchasePanel({
  code,
  country,
  availableDays,
  planCtx,
  done,
  summaryLine,
  selection,
  onApplyTripDays,
  onBackFromPlan,
  onCompletePlan,
  onChangeDays,
}: Props) {
  const isRegion = isRegionPackCode(code);
  const countryName = isRegion
    ? (planNameForRegionPackCode(code) ?? country?.nameKr ?? code.toUpperCase())
    : (country?.nameKr ?? code.toUpperCase());
  const chipValue = planCtx?.tripDays ?? null;

  return (
    <div className="pb-6">
      <div className="border-b border-[#f0f0f6] px-4 pb-5 pt-2">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-[#f0f0f6]">
            {isRegion ? (
              <RegionPackBadgeIcon code={code} emoji={country?.flag} size={48} />
            ) : (
              <SafeImage
                src={flagUrl(code)}
                alt=""
                width={48}
                height={48}
                quality={90}
                className="h-full w-full object-cover"
                sizes="48px"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold leading-[32px] tracking-[-1.1px] text-[#111]">
              {countryName}
            </h1>
          </div>
        </div>

        {isRegion ? <UsimsaRegionPackMetaRows regionCode={code} /> : null}

        {!isRegion ? (
          <div className="mt-4">
            <CountryPurchaseNoticeList countryCode={code} compact />
          </div>
        ) : null}

        {!done ? (
          <div className="mt-5">
            <DayChipPicker
              value={chipValue}
              options={availableDays}
              onChange={onApplyTripDays}
              label="이용 일수"
              hint="판매 중인 요금제에 맞는 일수만 표시됩니다."
            />
          </div>
        ) : null}
      </div>

      {done && selection ? (
        <div className="mx-4 mt-4 rounded-xl border border-[#dbeafe] bg-[#f3f8ff] px-4 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#121417]" title={summaryLine}>
                {summaryLine}
              </p>
              <EsimFreeDataBenefitLine product={selection.product} variant="summary" />
            </div>
            <TravelerVerificationProductBadge
              state={shouldShowBadge(
                selection.product,
                selection.kycDistribution ?? getKycLabelDistribution([selection.product]),
              )}
              size="sm"
              showHelpIcon
            />
          </div>
          <button
            type="button"
            onClick={onChangeDays}
            className="mt-2 text-[12px] font-semibold text-[#767676] underline decoration-[#ccc]"
          >
            일수·플랜 변경
          </button>
        </div>
      ) : null}

      {planCtx && !done ? (
        <PlanSelectPopup
          inline
          open
          countryName={countryName}
          countryCode={code}
          allSelectedCodes={[code]}
          tripDays={planCtx.tripDays}
          onBack={onBackFromPlan}
          onComplete={onCompletePlan}
        />
      ) : null}
    </div>
  );
}
