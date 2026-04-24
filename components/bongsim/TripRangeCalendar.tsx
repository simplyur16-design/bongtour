"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  compareYmd,
  daysInMonth,
  parseYmdLocal,
  toYmd,
  weekdayOfFirstOfMonth,
} from "@/lib/bongsim/trip-calendar-utils";

const WEEK_KR = ["일", "월", "화", "수", "목", "금", "토"];

type Props = {
  rangeLo: string;
  rangeHi: string;
  minYmd: string;
  onSelectDay: (ymd: string) => void;
};

function monthLabel(year: number, monthIndex: number) {
  return `${year}년 ${monthIndex + 1}월`;
}

export function TripRangeCalendar({ rangeLo, rangeHi, minYmd, onSelectDay }: Props) {
  const anchor = parseYmdLocal(rangeLo) ?? parseYmdLocal(minYmd) ?? new Date();
  const [viewY, setViewY] = useState(anchor.getFullYear());
  const [viewM, setViewM] = useState(anchor.getMonth());

  const cells = useMemo(() => {
    const dim = daysInMonth(viewY, viewM);
    const pad = weekdayOfFirstOfMonth(viewY, viewM);
    const out: ({ ymd: string } | null)[] = [];
    for (let i = 0; i < pad; i++) out.push(null);
    for (let d = 1; d <= dim; d++) {
      out.push({ ymd: toYmd(new Date(viewY, viewM, d)) });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewY, viewM]);

  const goPrev = () => {
    const { y, m } = addMonths(viewY, viewM, -1);
    setViewY(y);
    setViewM(m);
  };

  const goNext = () => {
    const { y, m } = addMonths(viewY, viewM, 1);
    setViewY(y);
    setViewM(m);
  };

  const cellTone = (ymd: string) => {
    if (compareYmd(ymd, minYmd) < 0) return "disabled";
    if (!rangeLo || !rangeHi) return "idle";
    if (compareYmd(ymd, rangeLo) < 0 || compareYmd(ymd, rangeHi) > 0) return "idle";
    if (ymd === rangeLo || ymd === rangeHi) return "edge";
    return "range";
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100/80 sm:mx-0 sm:max-w-none sm:p-4 lg:w-full lg:max-w-none lg:p-6">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrev}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-white"
          aria-label="이전 달"
        >
          ‹
        </button>
        <p className="min-w-0 flex-1 text-center text-[15px] font-bold text-slate-900 sm:text-base">{monthLabel(viewY, viewM)}</p>
        <button
          type="button"
          onClick={goNext}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-white"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-500 sm:text-xs">
        {WEEK_KR.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`e-${idx}`} className="aspect-square min-h-[2.35rem] sm:min-h-[2.75rem]" />;
          const tone = cellTone(cell.ymd);
          const dnum = parseYmdLocal(cell.ymd)!.getDate();
          const base =
            "relative flex aspect-square min-h-[2.35rem] w-full items-center justify-center rounded-xl text-[13px] font-bold transition sm:min-h-[2.75rem] sm:text-[15px]";
          if (tone === "disabled") {
            return (
              <div key={cell.ymd} className={`${base} cursor-not-allowed text-slate-300`}>
                {dnum}
              </div>
            );
          }
          if (tone === "range") {
            return (
              <button
                key={cell.ymd}
                type="button"
                onClick={() => onSelectDay(cell.ymd)}
                className={`${base} bg-teal-100/90 text-teal-950 hover:bg-teal-200/90`}
              >
                {dnum}
              </button>
            );
          }
          if (tone === "edge") {
            return (
              <button
                key={cell.ymd}
                type="button"
                onClick={() => onSelectDay(cell.ymd)}
                className={`${base} bg-teal-600 text-white shadow-md ring-2 ring-teal-300/80 hover:bg-teal-700`}
              >
                {dnum}
              </button>
            );
          }
          return (
            <button
              key={cell.ymd}
              type="button"
              onClick={() => onSelectDay(cell.ymd)}
              className={`${base} text-slate-800 hover:bg-slate-100`}
            >
              {dnum}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500 sm:text-[12px]">
        첫 날짜를 누른 뒤, 마지막 날짜를 눌러 기간을 표시해요. 기간을 바꾸려면 날짜를 다시 눌러 주세요.
      </p>
    </div>
  );
}
