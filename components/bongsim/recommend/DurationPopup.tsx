"use client";

import { useEffect, useMemo, useState } from "react";
import { RecommendModalShell } from "@/components/bongsim/recommend/RecommendModalShell";
import {
  startOfDay,
  isDayBlockedByOtherInteriors,
  isOtherCountryBoundaryDay,
  isRangeAllowedWithOthers,
  type CountryDateRange,
} from "@/lib/bongsim/recommend/country-date-ranges";

const BLUE = "#3B82F6";
const DISABLED = "#D1D5DB";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

function formatKrDate(d: Date): string {
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, "0")}월 ${String(d.getDate()).padStart(2, "0")}일`;
}

function inclusiveTripDays(start: Date, end: Date): number {
  const a = startOfDay(start).getTime();
  const b = startOfDay(end).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

function padMonthStartMonday(year: number, month: number): number {
  const first = new Date(year, month, 1);
  const dow = first.getDay();
  return (dow + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

type Props = {
  open: boolean;
  countryName: string;
  /** 플랜 단계에서 돌아올 때 기간 유지 */
  resumeApplied?: { start: Date; end: Date } | null | undefined;
  /** 현재 국가를 제외한 다른 국가들의 확정 기간 — 내부일 비활성·경계 점 표시 */
  otherCountryRanges?: CountryDateRange[];
  currentCountryCode?: string;
  onClose: () => void;
  /** 캘린더에서 이전 단계(망 선택 등) */
  onBack: () => void;
  onNext: (payload: { start: Date; end: Date; tripDays: number }) => void;
};

export function DurationPopup({
  open,
  countryName,
  resumeApplied,
  otherCountryRanges,
  currentCountryCode,
  onClose,
  onBack,
  onNext,
}: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const others = otherCountryRanges ?? [];
  const exclude = currentCountryCode ?? "";
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [pickingHint, setPickingHint] = useState<"시작일" | "종료일">("시작일");

  useEffect(() => {
    if (!open) {
      setCalendarOpen(false);
      setApplied(false);
      setRangeStart(null);
      setRangeEnd(null);
      setPickingHint("시작일");
    }
  }, [open]);

  const resumeKey = resumeApplied
    ? `${resumeApplied.start.getTime()}_${resumeApplied.end.getTime()}`
    : "";

  useEffect(() => {
    if (!open) return;
    if (resumeApplied) {
      setRangeStart(resumeApplied.start);
      setRangeEnd(resumeApplied.end);
      setApplied(true);
      setCalendarOpen(false);
      setPickingHint("종료일");
    } else {
      setRangeStart(null);
      setRangeEnd(null);
      setApplied(false);
      setCalendarOpen(false);
      setPickingHint("시작일");
    }
  }, [open, resumeKey]);

  const nightsAndDays = useMemo(() => {
    if (!rangeStart || !rangeEnd) return null;
    const days = inclusiveTripDays(rangeStart, rangeEnd);
    const nights = Math.max(0, days - 1);
    return { nights, days };
  }, [rangeStart, rangeEnd]);

  const openCalendar = () => {
    setCalendarOpen(true);
    setApplied(false);
  };

  const onDayClick = (d: Date) => {
    if (d < today) return;
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(d);
      setRangeEnd(null);
      setPickingHint("종료일");
    } else {
      if (d < rangeStart) {
        setRangeStart(d);
        setRangeEnd(null);
        setPickingHint("종료일");
      } else {
        if (!isRangeAllowedWithOthers(rangeStart, d, others, exclude)) return;
        setRangeEnd(d);
      }
    }
  };

  const resetCalendar = () => {
    setRangeStart(null);
    setRangeEnd(null);
    setPickingHint("시작일");
  };

  const applyRange = () => {
    if (!rangeStart || !rangeEnd) return;
    if (!isRangeAllowedWithOthers(rangeStart, rangeEnd, others, exclude)) return;
    setCalendarOpen(false);
    setApplied(true);
  };

  const months = useMemo(() => {
    const list: { y: number; m: number; label: string }[] = [];
    const base = new Date();
    for (let i = 0; i < 18; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      list.push({
        y: d.getFullYear(),
        m: d.getMonth(),
        label: `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
      });
    }
    return list;
  }, []);

  const inRange = (d: Date) => {
    if (!rangeStart) return false;
    const t = startOfDay(d).getTime();
    const a = startOfDay(rangeStart).getTime();
    if (!rangeEnd) return t === a;
    const b = startOfDay(rangeEnd).getTime();
    return t >= a && t <= b;
  };

  const isRangeEnd = (d: Date) =>
    rangeEnd && startOfDay(d).getTime() === startOfDay(rangeEnd).getTime();
  const isRangeStart = (d: Date) =>
    rangeStart && startOfDay(d).getTime() === startOfDay(rangeStart).getTime();

  const rangeValid = useMemo(() => {
    if (!rangeStart || !rangeEnd) return false;
    return isRangeAllowedWithOthers(rangeStart, rangeEnd, others, exclude);
  }, [rangeStart, rangeEnd, others, exclude]);

  const canApply = rangeValid;
  const canWizardNext = Boolean(
    applied && nightsAndDays != null && nightsAndDays.days >= 1 && rangeValid,
  );

  return (
    <RecommendModalShell open={open} onClose={onClose}>
      <div className="flex max-h-[92vh] flex-col">
        <div className="border-b border-slate-100 px-5 pb-4 pt-5">
          <h2 className="text-[1.05rem] font-bold leading-snug text-slate-900">
            {countryName}에 얼마 동안 머무시나요?
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!calendarOpen ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={openCalendar}
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
              >
                <div className="flex flex-wrap items-baseline gap-1 text-[15px]">
                  <span
                    className={
                      applied && rangeStart ? "font-semibold text-slate-900" : "text-slate-400"
                    }
                  >
                    {applied && rangeStart ? formatKrDate(rangeStart) : "2026년 MM월 DD일"}
                  </span>
                  <span className="text-slate-600">부터</span>
                </div>
              </button>
              <button
                type="button"
                onClick={openCalendar}
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
              >
                <div className="flex flex-wrap items-baseline gap-1 text-[15px]">
                  <span
                    className={applied && rangeEnd ? "font-semibold text-slate-900" : "text-slate-400"}
                  >
                    {applied && rangeEnd ? formatKrDate(rangeEnd) : "2026년 MM월 DD일"}
                  </span>
                  <span className="text-slate-600">까지 여행해요</span>
                </div>
              </button>

              {applied && nightsAndDays && (
                <p className="text-center text-[15px] font-bold" style={{ color: BLUE }}>
                  {nightsAndDays.nights}박 {nightsAndDays.days}일
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="mb-3 text-center text-[13px] font-semibold text-slate-700">
                {pickingHint === "시작일" ? "시작일을 선택하세요" : "종료일을 선택하세요"}
              </p>
              <div className="max-h-[48vh] space-y-6 overflow-y-auto pr-1">
                {months.map(({ y, m, label }) => (
                  <div key={`${y}-${m}`}>
                    <p className="mb-2 text-[14px] font-bold text-slate-800">{label}</p>
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold">
                      {WEEKDAY_LABELS.map((w, wi) => (
                        <div
                          key={w}
                          className={`py-1 ${
                            wi === 5 ? "text-blue-500" : wi === 6 ? "text-red-500" : "text-slate-500"
                          }`}
                        >
                          {w}
                        </div>
                      ))}
                      {(() => {
                        const pad = padMonthStartMonday(y, m);
                        const dim = daysInMonth(y, m);
                        const cells: (Date | null)[] = [];
                        for (let i = 0; i < pad; i++) cells.push(null);
                        for (let day = 1; day <= dim; day++) cells.push(new Date(y, m, day));
                        while (cells.length % 7 !== 0) cells.push(null);
                        return cells.map((cell, idx) => {
                          if (!cell) return <div key={idx} className="h-9" />;
                          const disabled =
                            cell < today ||
                            isDayBlockedByOtherInteriors(cell, others, exclude);
                          const sel = inRange(cell);
                          const edge = isRangeStart(cell) || isRangeEnd(cell);
                          const jsDay = cell.getDay();
                          const colFromMon = (jsDay + 6) % 7;
                          const isSat = colFromMon === 5;
                          const isSun = colFromMon === 6;
                          let weekendTone = "text-slate-800";
                          if (!disabled && !sel) {
                            if (isSat) weekendTone = "text-blue-500";
                            else if (isSun) weekendTone = "text-red-500";
                          }
                          const boundaryDot =
                            !disabled &&
                            isOtherCountryBoundaryDay(cell, others, exclude);
                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={disabled}
                              onClick={() => onDayClick(cell)}
                              className={`relative h-9 rounded-lg text-[13px] font-medium transition ${
                                disabled
                                  ? "cursor-not-allowed text-slate-300"
                                  : sel
                                    ? edge
                                      ? "bg-[#3B82F6] text-white"
                                      : "bg-sky-100 text-slate-900"
                                    : `${weekendTone} hover:bg-slate-100`
                              }`}
                            >
                              {cell.getDate()}
                              {boundaryDot ? (
                                <span
                                  className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-slate-400"
                                  aria-hidden
                                />
                              ) : null}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={resetCalendar}
                  className="text-[14px] font-semibold text-slate-600 underline decoration-slate-400"
                >
                  초기화
                </button>
                <button
                  type="button"
                  disabled={!canApply}
                  onClick={applyRange}
                  className="min-h-[2.75rem] min-w-[7rem] rounded-xl px-4 text-[14px] font-bold text-white disabled:cursor-not-allowed"
                  style={{ backgroundColor: canApply ? BLUE : DISABLED }}
                >
                  일정 적용
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={() => {
              if (calendarOpen) {
                setCalendarOpen(false);
                return;
              }
              if (applied) {
                setApplied(false);
                setCalendarOpen(true);
                return;
              }
              onBack();
            }}
            className="min-h-[3rem] flex-1 rounded-xl border-2 border-slate-200 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            이전
          </button>
          <button
            type="button"
            disabled={!canWizardNext || calendarOpen}
            onClick={() => {
              if (rangeStart && rangeEnd && nightsAndDays) {
                onNext({
                  start: rangeStart,
                  end: rangeEnd,
                  tripDays: nightsAndDays.days,
                });
              }
            }}
            className="min-h-[3rem] flex-1 rounded-xl text-[15px] font-bold text-white transition disabled:cursor-not-allowed"
            style={{
              backgroundColor: canWizardNext && !calendarOpen ? BLUE : DISABLED,
            }}
          >
            다음
          </button>
        </div>
      </div>
    </RecommendModalShell>
  );
}
