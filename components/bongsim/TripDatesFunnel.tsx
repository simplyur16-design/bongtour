"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { TripRangeCalendar } from "@/components/bongsim/TripRangeCalendar";
import { funnelTripDayCount, funnelTripNights, isFunnelReadyForDatesStep, bongsimPath } from '@/lib/bongsim/constants';
import { compareYmd, toYmd } from "@/lib/bongsim/trip-calendar-utils";
import { getCountryById, loadFunnel, saveFunnel } from "@/lib/bongsim/mock-data";
import type { FunnelState } from "@/lib/bongsim/types";

function todayYmd() {
  return toYmd(new Date());
}

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get("returnTo")?.trim() || "";

  const [funnel, setFunnel] = useState<FunnelState | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  /** 두 번째 날짜 탭까지 완료되면 null(첫 탭만이면 다음 날짜 대기). */
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const f = loadFunnel();
      setFunnel(f);
      if (f.tripStart && f.tripEnd) {
        setStart(f.tripStart);
        setEnd(f.tripEnd);
      } else {
        const t = todayYmd();
        setStart(t);
        setEnd(t);
      }
      setPendingAnchor(null);
    });
  }, []);

  const minY = todayYmd();

  const rangeLoHi = useMemo(() => {
    if (!start || !end) return { lo: minY, hi: minY };
    if (compareYmd(start, end) <= 0) return { lo: start, hi: end };
    return { lo: end, hi: start };
  }, [start, end, minY]);

  const metrics = useMemo(() => {
    if (!funnel || !start || !end) return { days: 0, nights: 0 };
    const draft: FunnelState = { ...funnel, tripStart: start, tripEnd: end };
    const d = funnelTripDayCount(draft);
    const n = funnelTripNights(draft);
    return { days: d, nights: n };
  }, [funnel, start, end]);

  const onSelectDay = (ymd: string) => {
    if (compareYmd(ymd, minY) < 0) return;

    if (pendingAnchor !== null) {
      const a = pendingAnchor;
      setPendingAnchor(null);
      if (compareYmd(ymd, a) < 0) {
        setStart(ymd);
        setEnd(a);
      } else {
        setStart(a);
        setEnd(ymd);
      }
      return;
    }

    setStart(ymd);
    setEnd(ymd);
    setPendingAnchor(ymd);
  };

  const submit = () => {
    if (!funnel || !start || !end || pendingAnchor !== null) return;
    const draft: FunnelState = { ...funnel, tripStart: start, tripEnd: end };
    if (funnelTripDayCount(draft) < 1) return;
    const next: FunnelState = {
      ...funnel,
      tripStart: start,
      tripEnd: end,
      network: null,
      planId: null,
      coverageProductId: null,
    };
    saveFunnel(next);
    setFunnel(next);
    const dest = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : bongsimPath("/result");
    router.push(dest);
  };

  if (funnel === null) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 sm:max-w-lg">
        <p className="text-center text-sm text-slate-500">불러오는 중이에요.</p>
      </main>
    );
  }

  if (!isFunnelReadyForDatesStep(funnel)) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 sm:max-w-lg">
        <p className="text-[15px] font-semibold text-slate-900">먼저 여행지를 골라 주세요.</p>
        <Link href={bongsimPath("/recommend")} className="mt-6 inline-flex min-h-11 items-center text-sm font-bold text-teal-700 underline">
          국가 선택으로
        </Link>
      </main>
    );
  }

  const canSubmit = pendingAnchor === null && metrics.days >= 1;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-12 xl:max-w-7xl xl:px-16">
      <div className="mx-auto max-w-lg lg:max-w-5xl xl:max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={bongsimPath("/recommend")}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-600 hover:text-teal-800"
          >
            ← 국가 선택
          </Link>
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-teal-800 ring-1 ring-teal-100">
            STEP 2 · 일정
          </span>
        </div>

        <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-[36%] rounded-full bg-teal-600" />
        </div>

        <header className="mt-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem] lg:text-3xl">
            여행 일정을 선택해 주세요.
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600 sm:text-[14px]">선택한 일정에 맞는 eSIM을 추천해드려요.</p>
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 text-[11px] leading-relaxed text-slate-600 sm:text-[12px]">
            여러 나라를 고른 경우, 나라마다 하루가 겹치는 경계일은 정상적인 일정이에요. 여기서는{" "}
            <strong className="text-slate-800">전체 여행 구간</strong>만 한 번 정해요.
          </p>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="선택한 국가">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">선택한 여행지</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {funnel.countryIds.map((cid) => {
              const c = getCountryById(cid);
              if (!c) return null;
              return (
                <span
                  key={cid}
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50/80 px-2.5 py-1 text-[12px] font-bold text-teal-950"
                >
                  <span className="text-base leading-none" aria-hidden>
                    {c.flag}
                  </span>
                  {c.nameKr}
                </span>
              );
            })}
          </div>
        </section>

        <section
          className="mt-8 space-y-6 lg:grid lg:grid-cols-[minmax(17.5rem,22.5rem)_minmax(0,1fr)] lg:items-start lg:gap-10 xl:gap-12"
          aria-label="여행 기간 달력"
        >
          <div className="min-w-0 lg:max-w-[22.5rem]">
            <TripRangeCalendar rangeLo={rangeLoHi.lo} rangeHi={rangeLoHi.hi} minYmd={minY} onSelectDay={onSelectDay} />
          </div>
          <div className="flex min-w-0 flex-col gap-5 lg:pt-1">
            <div className="rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-5 text-center sm:px-5 lg:text-left">
              <p className="text-[11px] font-semibold text-teal-900 lg:text-[12px]">자동 계산</p>
              <p className="mt-1 text-lg font-black text-teal-950 sm:text-xl">
                {metrics.days >= 1 ? (
                  <>
                    {metrics.days}일 <span className="text-[14px] font-bold text-teal-800">·</span> {metrics.nights}박
                  </>
                ) : (
                  "—"
                )}
              </p>
              {pendingAnchor !== null ? (
                <p className="mt-2 text-[12px] font-medium text-teal-900 lg:text-[13px]">
                  종료일(또는 같은 날 한 번 더)을 눌러 주세요.
                </p>
              ) : (
                <p className="mt-2 text-[12px] text-teal-800/90 lg:text-[13px]">출발과 귀국을 달력에서만 정해요.</p>
              )}
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="flex min-h-[3.35rem] w-full items-center justify-center rounded-2xl bg-teal-700 text-[16px] font-bold text-white shadow-md transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              추천 결과 보기
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export function TripDatesFunnel() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-4 py-20">
          <p className="text-center text-sm text-slate-500">불러오는 중이에요.</p>
        </main>
      }
    >
      <Inner />
    </Suspense>
  );
}

export function TripDatesPageShell() {
  return (
    <div className="min-h-full overflow-x-hidden bg-slate-50 pb-16 sm:pb-20">
      <TripDatesFunnel />
    </div>
  );
}
