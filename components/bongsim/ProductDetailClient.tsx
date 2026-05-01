"use client";

import SafeImage from "@/app/components/SafeImage";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DeviceCheckCard } from "@/components/bongsim/DeviceCheckCard";
import { DeviceCompatibilityModal } from "@/components/bongsim/DeviceCompatibilityModal";
import { ProductInfoSection } from "@/components/bongsim/ProductInfoSection";
import { StickyPurchaseBar } from "@/components/bongsim/StickyPurchaseBar";
import { funnelTripDayCount, funnelTripNights, bongsimPath } from '@/lib/bongsim/constants';
import { getEsimPlansForDuration, snapDuration } from "@/lib/bongsim/esim-detail";
import { encodeCovPlanId, getCountryById, getPlanById, loadFunnel } from "@/lib/bongsim/mock-data";
import type { EsimPlanOption, FunnelState, ProductPageModel } from "@/lib/bongsim/types";

function formatKrw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

function formatYmdDots(ymd: string | null): string {
  if (!ymd) return "";
  const p = ymd.split("-");
  if (p.length !== 3) return ymd;
  return `${p[0]}.${p[1]}.${p[2]}`;
}

function StarRow({ rating }: { rating: number }) {
  const filled = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`text-[15px] leading-none lg:text-[16px] ${i < filled ? "text-amber-400" : "text-slate-200"}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

type Props = {
  model: ProductPageModel;
};

export function ProductDetailClient({ model }: Props) {
  const pathname = usePathname();
  const { detail, covContext } = model;
  const [funnel, setFunnel] = useState<FunnelState | null>(null);
  const [freeDuration, setFreeDuration] = useState(model.initialDuration);
  const [pickedPlanId, setPickedPlanId] = useState<string | null>(model.initialPlanId);
  const [deviceOpen, setDeviceOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setFunnel(loadFunnel()));
  }, []);

  const datesReturnHref = bongsimPath(`/dates?returnTo=${encodeURIComponent(pathname || "/product")}`);

  const funnelTripDays = useMemo(() => {
    if (!funnel?.tripStart || !funnel?.tripEnd) return null;
    const n = funnelTripDayCount(funnel);
    return n >= 1 ? n : null;
  }, [funnel]);

  const tripNights = useMemo(() => {
    if (!funnel || funnelTripDays == null) return null;
    if (funnel.tripDurationNights != null) return funnel.tripDurationNights;
    return funnelTripNights(funnel);
  }, [funnel, funnelTripDays]);

  const tripFromFunnel = funnelTripDays != null;

  const effectiveDuration = useMemo(() => {
    if (funnelTripDays != null) return snapDuration(detail.durations, funnelTripDays);
    return freeDuration;
  }, [funnelTripDays, detail.durations, freeDuration]);

  const plans = useMemo((): EsimPlanOption[] => {
    if (covContext) {
      const id = encodeCovPlanId(
        covContext.productId,
        covContext.network,
        effectiveDuration,
        covContext.countryCodes,
      );
      const pl = getPlanById(id);
      if (!pl) return [];
      return [
        {
          id: pl.id,
          tierKey: "cov",
          title: pl.nameKo,
          subtitle: pl.dataSummaryKo,
          priceKrw: pl.priceKrw,
          isRecommended: true,
          benefitLines: pl.highlightsKo,
        },
      ];
    }
    return getEsimPlansForDuration(detail, effectiveDuration);
  }, [covContext, detail, effectiveDuration]);

  const pickDefaultForList = useCallback((list: EsimPlanOption[]) => {
    return list.find((p) => p.isRecommended)?.id ?? list[0]?.id ?? null;
  }, []);

  const effectivePlanId = useMemo(() => {
    if (plans.length === 0) return null;
    if (pickedPlanId && plans.some((p) => p.id === pickedPlanId)) return pickedPlanId;
    return pickDefaultForList(plans);
  }, [plans, pickedPlanId, pickDefaultForList]);

  const selected = plans.find((p) => p.id === effectivePlanId) ?? plans[0];
  const priceKrw = selected?.priceKrw ?? 0;
  const checkoutHref = selected ? bongsimPath(`/checkout?planId=${encodeURIComponent(selected.id)}`) : bongsimPath("/recommend");

  const setDurationAndResetPick = (d: number) => {
    setFreeDuration(d);
    setPickedPlanId(null);
  };

  const typeShortLabel =
    covContext?.network === "roaming" ? "로밍형" : covContext?.network === "local" ? "현지망형" : null;

  const coverageSummary = useMemo(() => {
    if (!covContext) return detail.serviceTagline ?? null;
    const names = covContext.countryCodes
      .map((c) => getCountryById(c)?.nameKr)
      .filter((x): x is string => !!x);
    const joined = names.length > 0 ? names.join(" · ") : "선택 경로";
    return typeShortLabel ? `${joined} · ${typeShortLabel}` : joined;
  }, [covContext, detail.serviceTagline, typeShortLabel]);

  const hasFunnelCountries = !!(funnel && funnel.countryIds.length > 0);

  return (
    <div className="min-h-full overflow-x-hidden bg-slate-50 pb-44 lg:pb-20">
      <div className="lg:mx-auto lg:max-w-6xl lg:px-10 xl:max-w-7xl xl:px-12">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_min(20rem,30%)] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_min(21rem,28%)] xl:gap-12 2xl:gap-14">
          <div className="min-w-0">
            <div className="relative -mx-4 mt-2 sm:-mx-6 lg:mx-0 lg:mt-0">
              <div className="relative aspect-[16/10] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-[2.2/1] lg:rounded-3xl lg:shadow-md lg:ring-1 lg:ring-slate-200/80">
                <SafeImage
                  src={detail.heroImage}
                  alt={detail.heroAlt ?? `${detail.nameKr} eSIM`}
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 62vw, 100vw"
                  priority
                  unoptimized
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/55 via-slate-950/10 to-transparent lg:rounded-3xl" />
              </div>
            </div>

            <div className="relative z-10 -mt-8 px-4 sm:-mt-10 sm:px-6 lg:mx-0 lg:mt-6 lg:px-0">
              <div className="rounded-3xl border border-slate-200/90 bg-white px-5 py-6 shadow-xl shadow-slate-900/10 ring-1 ring-slate-100/90 sm:px-7 lg:px-8 lg:py-8">
                <div className="flex items-start gap-4">
                  <span
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-[1.75rem] leading-none shadow-inner ring-1 ring-slate-100 lg:h-16 lg:w-16 lg:text-[2rem]"
                    aria-hidden
                  >
                    {detail.flag}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">STEP 5 · 데이터 전용 eSIM</p>
                    <h1 className="mt-1 break-words text-[1.4rem] font-bold leading-snug tracking-tight text-slate-900 lg:text-3xl">
                      {detail.nameKr}
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-900 ring-1 ring-teal-100">
                        eSIM
                      </span>
                      {typeShortLabel ? (
                        <span className="text-[12px] font-bold text-slate-700">{typeShortLabel}</span>
                      ) : null}
                    </div>
                    {coverageSummary ? (
                      <p className="mt-3 text-[13px] leading-relaxed text-slate-600 lg:text-[14px]">{coverageSummary}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-6 max-w-3xl px-4 sm:mt-8 sm:px-6 lg:mx-0 lg:mt-8 lg:max-w-2xl lg:px-0 xl:max-w-[42rem]">
              <Link
                href={bongsimPath("/result")}
                className="inline-flex text-[13px] font-semibold text-slate-600 underline-offset-2 hover:text-teal-800 hover:underline"
              >
                ← 비교·확인 단계로
              </Link>
            </div>

            <div className="mx-auto mt-6 max-w-3xl space-y-8 px-4 sm:px-6 lg:mx-0 lg:mt-8 lg:max-w-2xl lg:space-y-9 lg:px-0 xl:max-w-[42rem]">
              {selected ? (
                <section
                  className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100/80 sm:p-6"
                  aria-label="선택 상품 핵심 정보"
                >
                  <h2 className="text-[15px] font-bold text-slate-900">선택 요금제</h2>
                  <p className="mt-2 text-[16px] font-bold leading-snug text-slate-900">{selected.title}</p>
                  <dl className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-[13px]">
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                      <dt className="font-semibold text-slate-500">국가·지역</dt>
                      <dd className="font-medium text-slate-900">
                        {hasFunnelCountries && funnel
                          ? funnel.countryIds
                              .map((cid) => getCountryById(cid)?.nameKr)
                              .filter(Boolean)
                              .join(" · ") || coverageSummary || detail.nameKr
                          : coverageSummary ?? detail.nameKr}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                      <dt className="font-semibold text-slate-500">이용 기간</dt>
                      <dd className="font-medium text-slate-900">
                        {effectiveDuration}일
                        {tripFromFunnel && funnelTripDays != null
                          ? ` (여행 ${funnelTripDays}일${tripNights != null ? ` · ${tripNights}박` : ""})`
                          : ""}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                      <dt className="font-semibold text-slate-500">데이터</dt>
                      <dd className="min-w-0 text-right font-medium text-slate-900 sm:text-left">
                        {selected.subtitle ?? "—"}
                        {selected.isUnlimited === true ? (
                          <span className="mt-1 block text-[11px] font-bold text-violet-800">완전 무제한(정책형)</span>
                        ) : null}
                      </dd>
                    </div>
                    {detail.info.network?.trim() ? (
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                        <dt className="font-semibold text-slate-500">네트워크</dt>
                        <dd className="font-medium text-slate-900">{detail.info.network.trim()}</dd>
                      </div>
                    ) : null}
                    {typeShortLabel ? (
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                        <dt className="font-semibold text-slate-500">연결 유형</dt>
                        <dd className="font-bold text-teal-900">{typeShortLabel}</dd>
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                      <dt className="font-semibold text-slate-500">수량</dt>
                      <dd className="font-medium text-slate-900">1</dd>
                    </div>
                    <div className="flex flex-col gap-1 border-t border-slate-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
                      <dt className="font-semibold text-slate-500">금액</dt>
                      <dd className="text-xl font-black tabular-nums text-slate-900">{formatKrw(priceKrw)}</dd>
                    </div>
                  </dl>
                </section>
              ) : null}

              {hasFunnelCountries && funnel ? (
                <section
                  className="rounded-3xl border border-teal-100 bg-gradient-to-b from-white to-teal-50/40 px-5 py-5 shadow-sm ring-1 ring-teal-100/60 sm:px-6"
                  aria-label="여행 요약"
                >
                  <h2 className="text-[15px] font-bold text-slate-900">여행 요약</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {funnel.countryIds.map((cid) => {
                      const c = getCountryById(cid);
                      if (!c) return null;
                      return (
                        <span
                          key={cid}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[12px] font-bold text-slate-800 shadow-sm"
                        >
                          <span className="text-base leading-none" aria-hidden>
                            {c.flag}
                          </span>
                          {c.nameKr}
                        </span>
                      );
                    })}
                  </div>
                  {tripFromFunnel && funnel ? (
                    <>
                      <p className="mt-4 text-[14px] font-bold text-slate-900">
                        {formatYmdDots(funnel.tripStart)} ~ {formatYmdDots(funnel.tripEnd)}
                      </p>
                      <p className="mt-1 text-[13px] font-semibold text-slate-700">
                        {funnelTripDays}일
                        {tripNights != null ? ` · ${tripNights}박` : null} · 적용 플랜 {effectiveDuration}일
                      </p>
                      <Link
                        href={datesReturnHref}
                        className="mt-3 inline-block text-[12px] font-bold text-teal-800 underline-offset-2 hover:underline"
                      >
                        변경하기
                      </Link>
                    </>
                  ) : (
                    <p className="mt-4 text-[13px] leading-relaxed text-slate-600">
                      일정은 날짜 단계에서만 바꿀 수 있어요.
                      <Link href={datesReturnHref} className="ml-1 font-bold text-teal-800 underline-offset-2 hover:underline">
                        일정 입력·변경
                      </Link>
                    </p>
                  )}
                </section>
              ) : null}

              <ProductInfoSection info={detail.info} />

              {(detail.info.activation?.trim() || detail.info.startPolicy?.trim()) ? (
                <section
                  className="rounded-3xl border border-teal-100/80 bg-teal-50/40 px-5 py-5 shadow-sm ring-1 ring-teal-100/60 sm:px-6"
                  aria-label="개통·이용 안내"
                >
                  <h2 className="text-[15px] font-bold text-slate-900">개통·이용 안내</h2>
                  <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-slate-800">
                    {detail.info.activation?.trim() ? (
                      <li className="flex gap-2">
                        <span className="font-bold text-teal-800">·</span>
                        <span>{detail.info.activation.trim()}</span>
                      </li>
                    ) : null}
                    {detail.info.startPolicy?.trim() ? (
                      <li className="flex gap-2">
                        <span className="font-bold text-teal-800">·</span>
                        <span>{detail.info.startPolicy.trim()}</span>
                      </li>
                    ) : null}
                  </ul>
                </section>
              ) : null}

              <section
                className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 text-[12px] leading-relaxed text-slate-600 sm:px-5 sm:py-5"
                aria-label="유의 사항"
              >
                <h2 className="text-[13px] font-bold text-slate-800">유의 사항</h2>
                <ul className="mt-2.5 list-disc space-y-1.5 pl-4">
                  <li>결제(STEP 6)에서 금액·조건이 최종 확정돼요.</li>
                  <li>이 앱은 데모라 실제 통신사·결제망과 연결되지 않아요.</li>
                  <li>무제한·일일 고속 등 표기는 선택한 요금제 문구·상품 정의를 따릅니다.</li>
                </ul>
              </section>

              <section className="rounded-3xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm ring-1 ring-slate-100/80 sm:px-6 lg:py-5">
                <h2 className="text-[14px] font-bold text-slate-900 lg:text-[15px]">이용 가능 기기</h2>
                <p className="mt-1 text-[12px] text-slate-600">개통 전 호환 여부를 확인해 주세요.</p>
                <div className="mt-3">
                  <DeviceCheckCard onClick={() => setDeviceOpen(true)} />
                </div>
              </section>

              {detail.reviewRating != null && detail.reviewCount != null ? (
                <section className="rounded-3xl border border-slate-200/90 bg-white px-5 py-5 shadow-sm ring-1 ring-slate-100/80 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[15px] font-bold text-slate-900">리뷰 요약</h2>
                    <span className="text-[12px] font-semibold text-teal-800">전체보기 ›</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <p className="text-3xl font-black tabular-nums tracking-tight text-slate-900">{detail.reviewRating.toFixed(1)}</p>
                    <div className="pb-1">
                      <StarRow rating={detail.reviewRating} />
                      <p className="mt-1 text-[12px] font-medium text-slate-500">
                        총 {detail.reviewCount.toLocaleString("ko-KR")}건
                      </p>
                    </div>
                  </div>
                  {detail.reviewChips && detail.reviewChips.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {detail.reviewChips.map((c) => (
                        <span
                          key={c}
                          className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100/80 sm:p-6" aria-label="요금제">
                <h2 className="text-lg font-bold text-slate-900">요금제</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600 sm:text-[13px]">
                  {tripFromFunnel
                    ? "앞 단계에서 정한 여행 일정에 맞춘 금액이에요."
                    : "이용 일 수를 고르면 아래 금액이 바뀌어요."}
                </p>
                {!tripFromFunnel ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {detail.durations.map((d) => {
                      const sel = d === freeDuration;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDurationAndResetPick(d)}
                          className={`rounded-full px-4 py-2.5 text-sm font-bold transition ${
                            sel
                              ? "bg-teal-700 text-white shadow-md ring-2 ring-teal-200"
                              : "border border-slate-200 bg-white text-slate-700 hover:border-teal-200"
                          }`}
                        >
                          {d}일
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-[13px] font-semibold text-slate-800">적용: {effectiveDuration}일 플랜</p>
                )}

                <div className="mt-6 flex flex-col gap-3">
                  {plans.map((p) => {
                    const sel = p.id === effectivePlanId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPickedPlanId(p.id)}
                        className={`overflow-hidden rounded-2xl border-2 text-left transition ${
                          sel
                            ? "border-teal-600 bg-white shadow-md ring-2 ring-teal-100"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        {p.isRecommended ? (
                          <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-4 py-2 text-center text-[11px] font-bold text-white">
                            많이 고른 요금제
                          </div>
                        ) : null}
                        <div className="px-4 py-4 sm:px-5 sm:py-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[15px] font-bold leading-snug text-slate-900">{p.title}</p>
                              </div>
                              {p.subtitle ? (
                                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">{p.subtitle}</p>
                              ) : null}
                            </div>
                            <p className="shrink-0 text-lg font-black tabular-nums text-slate-900">{formatKrw(p.priceKrw)}</p>
                          </div>
                          <p className="mt-2 text-[11px] font-medium text-slate-400">부가세 포함 안내 기준가 · 결제 단계에서 확정</p>
                          {p.benefitLines && p.benefitLines.length > 0 ? (
                            <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-[12px] leading-relaxed text-slate-600">
                              {p.benefitLines.map((line) => (
                                <li key={line} className="flex gap-2">
                                  <span className="font-bold text-teal-700">·</span>
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="pb-8 pt-2 lg:pb-12">
                <Link
                  href={bongsimPath("/result")}
                  className="text-sm font-semibold text-slate-600 underline-offset-2 hover:text-teal-800 hover:underline"
                >
                  ← 비교·확인 단계로
                </Link>
              </div>
            </div>
          </div>

          <aside className="hidden min-w-0 lg:sticky lg:top-24 lg:block lg:self-start">
            <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg ring-1 ring-slate-100/90 lg:p-7">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">선택 요금제</p>
                <p className="mt-2 text-xl font-bold text-slate-900">{detail.nameKr}</p>
                <p className="mt-1 text-[13px] text-slate-600">
                  eSIM · {effectiveDuration}일
                  {typeShortLabel ? ` · ${typeShortLabel}` : ""}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-100">
                <p className="text-[11px] font-semibold text-slate-500">결제 예정 금액</p>
                <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-slate-900">{formatKrw(priceKrw)}</p>
              </div>
              {selected ? <p className="line-clamp-3 text-[13px] leading-relaxed text-slate-600">{selected.title}</p> : null}
              <Link
                href={checkoutHref}
                className="flex min-h-[3.35rem] w-full items-center justify-center rounded-2xl bg-teal-700 text-[16px] font-bold text-white shadow-lg transition hover:bg-teal-800"
              >
                결제하기
              </Link>
            </div>
          </aside>
        </div>
      </div>

      <StickyPurchaseBar
        variant="stacked-cta"
        priceKrw={priceKrw}
        priceCaption="결제 예정 금액"
        primaryHref={checkoutHref}
        primaryLabel="결제하기"
        hideFromLarge
      />

      <DeviceCompatibilityModal open={deviceOpen} onClose={() => setDeviceOpen(false)} />
    </div>
  );
}
