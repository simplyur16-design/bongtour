"use client";

import type { CountryOption } from "@/lib/bongsim/types";

const FLAG_EMOJI_FONT =
  "font-[family-name:var(--bongsim-flag-font)] [--bongsim-flag-font:'Segoe_UI_Emoji','Apple_Color_Emoji','Noto_Color_Emoji',sans-serif]";

type Props = {
  regions: CountryOption[];
  selectedCodes: string[];
  onSelect: (code: string) => void;
};

export function MultiRegionPickerGrid({ regions, selectedCodes, onSelect }: Props) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-2 lg:gap-5 xl:grid-cols-4">
      {regions.map((r) => {
        const sel = selectedCodes.includes(r.code);
        return (
          <li key={r.code} className="min-w-0">
            <button
              type="button"
              onClick={() => onSelect(r.code)}
              className={`flex w-full min-h-[5.5rem] items-center gap-4 rounded-2xl border px-4 py-4 text-left shadow-sm transition sm:min-h-[6rem] sm:px-5 sm:py-4 ${
                sel
                  ? "border-teal-500 bg-teal-50/90 ring-2 ring-teal-400/50"
                  : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50/80 active:scale-[0.99]"
              }`}
            >
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[2rem] leading-none shadow-inner ring-1 sm:h-16 sm:w-16 sm:text-[2.25rem] ${FLAG_EMOJI_FONT} ${
                  sel ? "bg-white ring-teal-200" : "bg-slate-50 ring-slate-100"
                }`}
                aria-hidden
              >
                {r.flag}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[15px] font-bold leading-snug sm:text-base ${sel ? "text-teal-950" : "text-slate-900"}`}>
                  {r.nameKr}
                </span>
                {r.subtitleKr ? (
                  <span className="mt-1 block text-[12px] leading-snug text-slate-600 sm:text-[13px]">{r.subtitleKr}</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
