"use client";

import { CountryPickerFlagButton } from "@/components/bongsim/recommend/CountryPickerFlagButton";
import { COUNTRY_PICKER_GRID_CLASS } from "@/components/bongsim/CountryPickerGrid";
import type { CountryOption } from "@/lib/bongsim/types";
import {
  destinationUsesFlagImage,
  resolveDestinationFlagImageUrl,
} from "@/lib/bongsim/recommend/destination-flag-image";

type Props = {
  title?: string;
  subtitle?: string;
  countries: CountryOption[];
  selectedCodes: string[];
  onSelect: (code: string) => void;
  emptyMessage?: string;
  gridClassName?: string;
  hideHeading?: boolean;
};

/** usimsa — 국기 그리드 (52px·무제한 배지) */
export function CountryPickerSection({
  title,
  subtitle,
  countries,
  selectedCodes,
  onSelect,
  emptyMessage,
  gridClassName = COUNTRY_PICKER_GRID_CLASS,
  hideHeading = false,
}: Props) {
  if (countries.length === 0 && emptyMessage) {
    return (
      <section className="px-4 py-5">
        {!hideHeading && title ? <SectionHeading title={title} subtitle={subtitle} /> : null}
        <p className="py-6 text-center text-[13px] text-[#767676]">{emptyMessage}</p>
      </section>
    );
  }

  if (countries.length === 0) return null;

  return (
    <section className="px-4 py-5">
      {!hideHeading && title ? <SectionHeading title={title} subtitle={subtitle} /> : null}
      <div className={`${hideHeading || !title ? "" : "mt-3"} ${gridClassName}`}>
        {countries.map((country) => (
          <CountryPickerFlagButton
            key={country.code}
            country={country}
            isSelected={selectedCodes.includes(country.code)}
            onClick={() => onSelect(country.code)}
            flagImageSrc={resolveDestinationFlagImageUrl(country.code)}
            useFlagImage={destinationUsesFlagImage(country.code)}
          />
        ))}
      </div>
    </section>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-[18px] font-medium leading-[26px] tracking-[-0.9px] text-[#111]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-0.5 text-[13px] font-normal leading-[20px] tracking-[-0.65px] text-[#767676]">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
