"use client";

import SafeImage from "@/app/components/SafeImage";
import { RegionPackBadgeIcon } from "@/components/bongsim/recommend/RegionPackBadgeIcon";
import { CountryNameMultiline } from "@/lib/bongsim/country-name-display";
import type { CountryOption } from "@/lib/bongsim/types";
import {
  USIMSA_COUNTRY_FLAG_BOX_CLASS,
  USIMSA_COUNTRY_FLAG_PX,
  USIMSA_COUNTRY_LABEL_CLASS,
  USIMSA_COUNTRY_LABEL_SELECTED_CLASS,
  USIMSA_COUNTRY_SUBTITLE_CLASS,
  USIMSA_COUNTRY_SUBTITLE_SELECTED_CLASS,
} from "@/lib/bongsim/recommend/usimsa-country-picker-tokens";
import { isRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";
import { USIMSA_BLUE } from "@/lib/bongsim/recommend/duration-from-days";

const FLAG_EMOJI_FONT =
  "font-[family-name:var(--bongsim-flag-font)] [--bongsim-flag-font:'Segoe_UI_Emoji','Apple_Color_Emoji','Noto_Color_Emoji',sans-serif]";

type Props = {
  country: CountryOption;
  isSelected: boolean;
  onClick: () => void;
  onPrefetch?: () => void;
  flagImageSrc: string | null;
  useFlagImage: boolean;
  /** 다국가 탭 — 한 줄 라벨 (유럽 42개국 등) */
  displayNameKr?: string;
  /** usimsa 인기국가 우측상단 무제한 */
  showUnlimited?: boolean;
};

/** 인기/전체/다국가 그리드 공통 — usimsa 국기·배지·국가명 */
export function CountryPickerFlagButton({
  country,
  isSelected,
  onClick,
  onPrefetch,
  flagImageSrc,
  useFlagImage,
  displayNameKr,
  showUnlimited = country.isUnlimited === true,
}: Props) {
  const label = displayNameKr ?? country.nameKr;
  const showSubtitle = !displayNameKr && country.subtitleKr;
  const isRegionPack = isRegionPackCode(country.code);
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
      className="flex w-full min-w-0 flex-col items-center overflow-visible px-0.5 py-2"
    >
      <span className="relative z-0 flex shrink-0 flex-col items-center overflow-visible">
        <span
          className={`flex ${USIMSA_COUNTRY_FLAG_BOX_CLASS} shrink-0 items-center justify-center overflow-hidden rounded-full transition ${
            isSelected ? "ring-2 ring-[#0176f9]" : "ring-1 ring-[#e5e5ec]"
          }`}
          aria-hidden
        >
          {isRegionPack ? (
            <RegionPackBadgeIcon code={country.code} emoji={country.flag} size={USIMSA_COUNTRY_FLAG_PX} />
          ) : useFlagImage && flagImageSrc ? (
            <SafeImage
              src={flagImageSrc}
              alt=""
              width={USIMSA_COUNTRY_FLAG_PX}
              height={USIMSA_COUNTRY_FLAG_PX}
              quality={90}
              className="h-full w-full object-cover"
              sizes={`${USIMSA_COUNTRY_FLAG_PX}px`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              className={`flex h-full w-full items-center justify-center bg-[#f7f7f7] text-[1.75rem] leading-none ${FLAG_EMOJI_FONT}`}
            >
              {country.flag}
            </span>
          )}
        </span>
        {showUnlimited ? (
          <span
            className="absolute -right-0.5 -top-0.5 z-10 rounded-[10px] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm"
            style={{ backgroundColor: USIMSA_BLUE }}
          >
            무제한
          </span>
        ) : null}
      </span>
      <CountryNameMultiline
        nameKr={label}
        className={`${USIMSA_COUNTRY_LABEL_CLASS} ${
          isSelected ? USIMSA_COUNTRY_LABEL_SELECTED_CLASS : ""
        }`}
      />
      {showSubtitle ? (
        <span
          className={`${USIMSA_COUNTRY_SUBTITLE_CLASS} ${
            isSelected ? USIMSA_COUNTRY_SUBTITLE_SELECTED_CLASS : ""
          }`}
        >
          {country.subtitleKr}
        </span>
      ) : null}
    </button>
  );
}
