"use client";

import Link from "next/link";
import type { CountryOption } from "@/lib/bongsim/types";
import { bongsimPath } from "@/lib/bongsim/constants";

const FLAG_EMOJI_FONT =
  "font-[family-name:var(--bongsim-flag-font)] [--bongsim-flag-font:'Segoe_UI_Emoji','Apple_Color_Emoji','Noto_Color_Emoji',sans-serif]";

type Props = {
  items: CountryOption[];
  onBeforeNavigate?: (code: string) => void;
};

export function HomeDestinationGrid({ items, onBeforeNavigate }: Props) {
  return (
    <ul className="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-6 lg:grid-cols-6 lg:gap-x-4 lg:gap-y-7">
      {items.map((c) => {
        const showUnlimited = c.isUnlimited === true;
        return (
          <li key={c.code} className="min-w-0">
            <Link
              href={bongsimPath(`/recommend?country=${encodeURIComponent(c.code)}`)}
              onClick={() => onBeforeNavigate?.(c.code)}
              className="group flex min-h-[6.25rem] w-full flex-col items-center gap-2 rounded-2xl px-1 pb-2.5 pt-3 transition active:scale-[0.97] active:bg-slate-100"
            >
              <span className="relative flex shrink-0 flex-col items-center">
                <span
                  className={`flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center overflow-visible rounded-full bg-slate-100 text-[2.125rem] leading-none shadow-inner ring-1 ring-slate-200/80 transition group-hover:bg-white group-hover:ring-teal-200 sm:h-16 sm:w-16 sm:text-[2.25rem] ${FLAG_EMOJI_FONT}`}
                  aria-hidden
                >
                  <span className="block translate-y-px">{c.flag}</span>
                </span>
                {showUnlimited ? (
                  <span className="absolute -right-0.5 -top-0.5 rounded-md bg-sky-600 px-1 py-0.5 text-[8px] font-bold leading-none text-white shadow-sm">
                    무제한
                  </span>
                ) : null}
              </span>
              <span className="line-clamp-2 w-full px-0.5 text-center text-[12px] font-bold leading-tight text-slate-900 sm:text-[13px]">
                {c.nameKr}
              </span>
              {c.subtitleKr ? (
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
