"use client";

import Link from "next/link";
import SafeImage from "@/app/components/SafeImage";
import { RegionPackBadgeIcon } from "@/components/bongsim/recommend/RegionPackBadgeIcon";
import type { CountryOption } from "@/lib/bongsim/types";
import { bongsimPath } from "@/lib/bongsim/constants";
import {
  destinationUsesFlagImage,
  resolveDestinationFlagImageUrl,
} from "@/lib/bongsim/recommend/destination-flag-image";
import { isRegionPackCode, regionPackGridLabel } from "@/lib/bongsim/recommend/region-pack-plan";

const FLAG_PX = 60;

type Props = {
  items: CountryOption[];
  onBeforeNavigate?: (code: string) => void;
};

/** 홈·랜딩 목적지 국기 카드 — 추천 Step1과 동일 ISO/캐러셀 SSOT */
export function HomeDestinationGrid({ items, onBeforeNavigate }: Props) {
  return (
    <ul className="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-6 lg:grid-cols-6 lg:gap-x-4 lg:gap-y-7">
      {items.map((c) => {
        const showUnlimited = c.isUnlimited === true;
        const isRegion = isRegionPackCode(c.code);
        const label = isRegion ? regionPackGridLabel(c.code, c) : c.nameKr;
        const useFlagImage = destinationUsesFlagImage(c.code);
        const flagSrc = resolveDestinationFlagImageUrl(c.code);
        return (
          <li key={c.code} className="min-w-0">
            <Link
              href={bongsimPath(`/recommend?country=${encodeURIComponent(c.code)}`)}
              onClick={() => onBeforeNavigate?.(c.code)}
              className="group flex min-h-[6.25rem] w-full flex-col items-center gap-2 rounded-2xl px-1 pb-2.5 pt-3 transition active:scale-[0.97] active:bg-slate-100"
            >
              <span className="relative flex shrink-0 flex-col items-center">
                <span
                  className="flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 shadow-inner ring-1 ring-slate-200/80 transition group-hover:bg-white group-hover:ring-teal-200 sm:h-16 sm:w-16"
                  aria-hidden
                >
                  {isRegion ? (
                    <RegionPackBadgeIcon code={c.code} emoji={c.flag} size={FLAG_PX} />
                  ) : useFlagImage ? (
                    <SafeImage
                      src={flagSrc}
                      alt=""
                      width={FLAG_PX}
                      height={FLAG_PX}
                      quality={90}
                      className="h-full w-full object-cover"
                      sizes={`${FLAG_PX}px`}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-[2.125rem] leading-none sm:text-[2.25rem]">{c.flag}</span>
                  )}
                </span>
                {showUnlimited ? (
                  <span className="absolute -right-0.5 -top-0.5 rounded-md bg-sky-600 px-1 py-0.5 text-[8px] font-bold leading-none text-white shadow-sm">
                    무제한
                  </span>
                ) : null}
              </span>
              <span className="line-clamp-2 w-full px-0.5 text-center text-[12px] font-bold leading-tight text-slate-900 sm:text-[13px]">
                {label}
              </span>
              {!isRegion && c.subtitleKr ? (
                <span className="line-clamp-2 w-full px-0.5 text-center text-[10px] font-medium leading-tight text-slate-500">
                  {c.subtitleKr}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
