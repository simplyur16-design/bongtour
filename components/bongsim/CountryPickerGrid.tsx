"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useMediaQueryBelow } from "@/hooks/useMediaQueryBelow";
import { CountryNameMultiline } from "@/lib/bongsim/country-name-display";
import type { CountryOption } from "@/lib/bongsim/types";

/**
 * 국기 렌더링 방식:
 * - ISO alpha-2 코드가 있고 `isRegion`이 false면 flagcdn.com PNG + `next/image` 최적화
 *   (Windows Chrome/Edge에서 컬러 이모지 미지원 문제 우회)
 * - 아니면(지역·가짜 코드) 원본 이모지 fallback.
 */
const FLAG_EMOJI_FONT =
  "font-[family-name:var(--bongsim-flag-font)] [--bongsim-flag-font:'Segoe_UI_Emoji','Apple_Color_Emoji','Noto_Color_Emoji',sans-serif]";

const ISO_ALPHA2_RE = /^[a-z]{2}$/;

const MOBILE_BREAKPOINT_PX = 768;

/** 고해상도 원본(w160) — 표시 크기는 `sizes`·width/height로 제한 */
function flagImageUrl(code: string): string {
  return `https://flagcdn.com/w160/${code}.png`;
}

type Props = {
  countries: CountryOption[];
  /** 단일 선택 모드 */
  selectedCode?: string | null;
  /** 다중 선택 모드 — 있으면 이 배열로 선택 표시 */
  selectedCodes?: string[];
  onSelect: (code: string) => void;
  /** Tailwind grid 클래스 (override). 미지정 시 마이리얼트립 스타일 5→7→9열 */
  gridClassName?: string;
  /**
   * 모바일(`<768px`)에서 처음 N개만 표시하고 "더보기"로 전체 펼침.
   * `0`이면 비활성(항상 전체 표시).
   */
  mobileCollapseInitialCount?: number;
};

/** 인기 여행지 / 전체 국가 그리드 공통 — 모바일 5열, `sm` 7열, `md+` 9열 */
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
      <ul className={`px-2 ${gridClassName}`}>
        {visibleCountries.map((c) => {
          const sel = selectedCodes?.length
            ? selectedCodes.includes(c.code)
            : selectedCode === c.code;
          const showUnlimited = c.isUnlimited === true;
          const useFlagImage = !c.isRegion && ISO_ALPHA2_RE.test(c.code);
          return (
            <li key={c.code} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect(c.code)}
                className="flex w-full min-w-0 flex-col items-center px-1 py-2"
              >
                <span className="relative flex shrink-0 flex-col items-center">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full transition hover:scale-105 ${
                      sel
                        ? "shadow-lg ring-2 ring-blue-400"
                        : "shadow-lg ring-1 ring-gray-200"
                    }`}
                    aria-hidden
                  >
                    {useFlagImage ? (
                      <Image
                        src={flagImageUrl(c.code)}
                        alt=""
                        width={48}
                        height={48}
                        quality={90}
                        className="h-full w-full object-cover"
                        sizes="48px"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span
                        className={`flex h-full w-full items-center justify-center bg-slate-50 text-[1.6rem] leading-none ${FLAG_EMOJI_FONT}`}
                      >
                        {c.flag}
                      </span>
                    )}
                  </span>
                  {showUnlimited ? (
                    <span className="absolute -right-0.5 -top-0.5 rounded-md bg-sky-600 px-1 py-0.5 text-[8px] font-bold leading-none text-white shadow-sm">
                      무제한
                    </span>
                  ) : null}
                </span>
                <CountryNameMultiline
                  nameKr={c.nameKr}
                  className={`mt-1 w-full min-w-0 px-0.5 text-xs ${
                    sel ? "font-bold text-blue-500" : "font-medium text-gray-700"
                  }`}
                />
                {c.subtitleKr ? (
                  <span className="mt-0.5 line-clamp-1 w-full min-w-0 px-0.5 text-center text-[9px] font-medium leading-tight text-slate-500 sm:text-[10px]">
                    {c.subtitleKr}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {useCollapse ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          {showAll ? "접기" : `더보기 (+${extraCount}개국)`}
        </button>
      ) : null}
    </div>
  );
}
