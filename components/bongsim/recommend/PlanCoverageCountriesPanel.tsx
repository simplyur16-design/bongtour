"use client";

import { useMemo, useState, type MouseEvent } from "react";
import {
  coveragePreviewLabel,
  EU_COVERAGE_FOOTNOTES,
  isEuropeRegionDestination,
  listCoverageCountries,
} from "@/lib/bongsim/plan-coverage-display";

type Props = {
  destinationCode?: string;
  planName?: string;
  /** 클릭이 부모 카드/버튼으로 전파되지 않게 할 때 */
  stopPropagation?: boolean;
  className?: string;
};

export function PlanCoverageCountriesPanel({
  destinationCode,
  planName,
  stopPropagation = false,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const countries = useMemo(
    () => listCoverageCountries({ destinationCode, planName }),
    [destinationCode, planName],
  );

  if (countries.length === 0) return null;

  const preview = coveragePreviewLabel(countries);
  const showEuFootnotes = isEuropeRegionDestination(destinationCode);

  const onToggle = (e: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) e.stopPropagation();
    setOpen((v) => !v);
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 ${className}`}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      onKeyDown={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-slate-700">포함 국가 {countries.length}개</p>
        <button
          type="button"
          onClick={onToggle}
          className="text-[12px] font-semibold text-teal-700 underline-offset-2 hover:underline"
        >
          {open ? "접기" : "더보기"}
        </button>
      </div>
      {!open && preview ? (
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{preview}</p>
      ) : null}
      {open ? (
        <>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
            {countries.map((c) => (
              <li key={c.code} className="text-[11px] text-slate-700">
                {c.nameKr}
              </li>
            ))}
          </ul>
          {showEuFootnotes ? (
            <ul className="mt-2 space-y-0.5 border-t border-slate-200/80 pt-2">
              {EU_COVERAGE_FOOTNOTES.map((note) => (
                <li key={note} className="text-[10px] leading-relaxed text-slate-500">
                  · {note}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
