"use client";

import { CountryPickerFlagButton } from "@/components/bongsim/recommend/CountryPickerFlagButton";
import { CountryPickerSeeMoreTile } from "@/components/bongsim/recommend/CountryPickerSeeMoreTile";
import type { UsimsaPickerItem } from "@/lib/bongsim/recommend/usimsa-picker-item";
import {
  destinationUsesFlagImage,
  resolveDestinationFlagImageUrl,
} from "@/lib/bongsim/recommend/destination-flag-image";
import { USIMSA_COUNTRY_GRID_CLASS } from "@/lib/bongsim/recommend/usimsa-country-picker-tokens";

type Props = {
  items: UsimsaPickerItem[];
  selectedCodes: string[];
  onSelect: (code: string) => void;
  onPrefetch?: (code: string) => void;
  showSeeMore?: boolean;
  onSeeMore?: () => void;
  gridClassName?: string;
};

/** usimsa 4열 국기 그리드 + 선택적 더보기 타일 */
export function UsimsaCountryPickerGrid({
  items,
  selectedCodes,
  onSelect,
  onPrefetch,
  showSeeMore = false,
  onSeeMore,
  gridClassName = USIMSA_COUNTRY_GRID_CLASS,
}: Props) {
  return (
    <div className={gridClassName}>
      {items.map((country) => (
        <CountryPickerFlagButton
          key={country.code}
          country={country}
          displayNameKr={country.displayNameKr}
          isSelected={selectedCodes.includes(country.code)}
          onClick={() => onSelect(country.code)}
          onPrefetch={onPrefetch ? () => onPrefetch(country.code) : undefined}
          flagImageSrc={resolveDestinationFlagImageUrl(country.code)}
          useFlagImage={destinationUsesFlagImage(country.code)}
          showUnlimited={country.isUnlimited === true}
        />
      ))}
      {showSeeMore && onSeeMore ? <CountryPickerSeeMoreTile onClick={onSeeMore} /> : null}
    </div>
  );
}
