"use client";

import { useEffect, useState } from "react";
import { CountryPickerFlagButton } from "@/components/bongsim/recommend/CountryPickerFlagButton";
import { useMediaQueryBelow } from "@/hooks/useMediaQueryBelow";
import type { CountryOption } from "@/lib/bongsim/types";
import {
  destinationUsesFlagImage,
  resolveDestinationFlagImageUrl,
} from "@/lib/bongsim/recommend/destination-flag-image";

const MOBILE_BREAKPOINT_PX = 768;

type Props = {
  countries: CountryOption[];
  selectedCode?: string | null;
  selectedCodes?: string[];
  onSelect: (code: string) => void;
  gridClassName?: string;
  mobileCollapseInitialCount?: number;
};

export const COUNTRY_PICKER_GRID_CLASS = "grid w-full grid-cols-5 gap-2 sm:grid-cols-7 md:grid-cols-9";

export function CountryPickerGrid({
  countries,
  selectedCode,
  selectedCodes,
  onSelect,
  gridClassName = COUNTRY_PICKER_GRID_CLASS,
  mobileCollapseInitialCount = 20,
}: Props) {
  const isMobile = useMediaQueryBelow(MOBILE_BREAKPOINT_PX);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setShowAll(false);
  }, [countries]);

  const useCollapse =
    mobileCollapseInitialCount > 0 && isMobile && countries.length > mobileCollapseInitialCount;
  const visibleCountries =
    useCollapse && !showAll ? countries.slice(0, mobileCollapseInitialCount) : countries;
  const extraCount = Math.max(0, countries.length - mobileCollapseInitialCount);

  return (
    <div className="w-full">
      <ul className={`px-0 ${gridClassName}`}>
        {visibleCountries.map((c) => {
          const sel = selectedCodes?.length
            ? selectedCodes.includes(c.code)
            : selectedCode === c.code;
          return (
            <li key={c.code} className="min-w-0">
              <CountryPickerFlagButton
                country={c}
                isSelected={sel}
                onClick={() => onSelect(c.code)}
                flagImageSrc={resolveDestinationFlagImageUrl(c.code)}
                useFlagImage={destinationUsesFlagImage(c.code)}
              />
            </li>
          );
        })}
      </ul>

      {useCollapse ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 w-full rounded-lg border border-[#f0f0f6] py-3 text-[14px] font-medium text-[#767676] transition hover:bg-[#f7f7f7]"
        >
          {showAll ? "접기" : `더보기 (+${extraCount}개국)`}
        </button>
      ) : null}
    </div>
  );
}
