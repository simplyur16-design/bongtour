"use client";

import {
  USIMSA_COUNTRY_FLAG_BOX_CLASS,
  USIMSA_COUNTRY_LABEL_CLASS,
} from "@/lib/bongsim/recommend/usimsa-country-picker-tokens";

/** usimsa 다국가 타일 — 회색 원 + ⋯ + 더보기 */
export function CountryPickerSeeMoreTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-w-0 flex-col items-center px-0.5 py-2"
    >
      <span
        className={`flex ${USIMSA_COUNTRY_FLAG_BOX_CLASS} shrink-0 items-center justify-center rounded-full bg-[#f7f7f7] ring-1 ring-[#e5e5ec]`}
        aria-hidden
      >
        <svg className="h-5 w-5 text-[#767676]" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
        </svg>
      </span>
      <span className={USIMSA_COUNTRY_LABEL_CLASS}>
        더보기
      </span>
    </button>
  );
}
