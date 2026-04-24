"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { CheckoutCountryLine, CheckoutTripSummaryView } from "@/lib/bongsim/checkout-display";
import { formatCheckoutDateDots } from "@/lib/bongsim/checkout-display";
import type { MockPlan } from "@/lib/bongsim/types";

function formatKrw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

type Props = {
  plan: MockPlan;
  planId: string;
  countries: CheckoutCountryLine[];
  networkLabel: string | null;
  tripSummary: CheckoutTripSummaryView;
  productBackHref: string;
  productBackLabel: string;
  datesAdjustHref: string;
  resultAdjustHref: string;
  childrenForm: ReactNode;
  payShell: ReactNode;
  desktopSummaryCta: ReactNode;
};

const QTY = 1;

function SectionCard({
  title,
  eyebrow,
  subtitle,
  children,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100/80 sm:p-6 lg:rounded-3xl lg:p-7">
      {eyebrow ? (
        <p className="text-[11px] font-bold uppercase tracking-wide text-teal-800">{eyebrow}</p>
      ) : null}
      <h2 className={`text-lg font-bold tracking-tight text-slate-900 ${eyebrow ? "mt-1" : ""}`}>{title}</h2>
      {subtitle ? <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{subtitle}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function OrderTopSummary({
  plan,
  countries,
  networkLabel,
  tripSummary,
}: {
  plan: MockPlan;
  countries: CheckoutCountryLine[];
  networkLabel: string | null;
  tripSummary: CheckoutTripSummaryView;
}) {
  const lineTotal = plan.priceKrw * QTY;
  return (
    <section
      className="overflow-hidden rounded-3xl border border-teal-100 bg-gradient-to-br from-white via-teal-50/30 to-white p-5 shadow-md ring-1 ring-teal-100/70 sm:p-6 lg:p-8"
      aria-label="주문 요약"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-teal-800">주문 요약</p>
      <h2 className="mt-2 break-words text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl lg:text-[1.65rem]">
        {plan.nameKo}
      </h2>
      {plan.dataSummaryKo ? (
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-600">{plan.dataSummaryKo}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {countries.length > 0 ? (
          countries.map((c) => (
            <span
              key={c.code}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/90 bg-white/95 px-3 py-1.5 text-[12px] font-bold text-slate-800 shadow-sm ring-1 ring-slate-100"
            >
              <span aria-hidden>{c.flag}</span>
              {c.nameKr}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-amber-100/90 bg-amber-50/90 px-3 py-1.5 text-[12px] font-semibold text-amber-950">
            국가·지역 태그 없음 (요금제명 기준으로 진행)
          </span>
        )}
      </div>

      <dl className="mt-5 grid gap-3 border-t border-teal-100/80 pt-5 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-slate-100/90">
          <dt className="text-[11px] font-bold text-slate-500">수량</dt>
          <dd className="mt-1 font-bold text-slate-900">{QTY}개</dd>
        </div>
        <div className="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-slate-100/90">
          <dt className="text-[11px] font-bold text-slate-500">여행 기간</dt>
          <dd className="mt-1 font-bold text-slate-900">
            {tripSummary.hasSchedule && tripSummary.startYmd && tripSummary.endYmd ? (
              <>
                {formatCheckoutDateDots(tripSummary.startYmd)} ~ {formatCheckoutDateDots(tripSummary.endYmd)}
              </>
            ) : (
              <span className="text-slate-600">일정 미연동 · 요금제 {tripSummary.planValidityDays}일</span>
            )}
          </dd>
        </div>
        <div className="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-slate-100/90">
          <dt className="text-[11px] font-bold text-slate-500">여행 일정</dt>
          <dd className="mt-1 font-bold text-slate-900">
            {tripSummary.hasSchedule && tripSummary.days != null ? (
              <>
                {tripSummary.days}일
                {tripSummary.nights != null ? ` · ${tripSummary.nights}박` : null}
              </>
            ) : (
              <span className="font-semibold text-slate-600">요금제 {tripSummary.planValidityDays}일 기준</span>
            )}
          </dd>
        </div>
        {networkLabel ? (
          <div className="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-slate-100/90 sm:col-span-2 lg:col-span-1">
            <dt className="text-[11px] font-bold text-slate-500">네트워크 유형</dt>
            <dd className="mt-1 font-bold text-slate-900">{networkLabel}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-6 space-y-2 border-t border-teal-100/80 pt-5">
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="font-semibold text-slate-600">상품 금액</span>
          <span className="tabular-nums font-bold text-slate-800">
            {formatKrw(plan.priceKrw)} × {QTY}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-[12px] font-bold text-slate-700">최종 결제 금액</p>
          <p className="text-2xl font-black tabular-nums tracking-tight text-slate-900 sm:text-3xl">{formatKrw(lineTotal)}</p>
        </div>
      </div>
    </section>
  );
}

function AsideSummary({
  plan,
  countries,
  networkLabel,
  tripSummary,
}: {
  plan: MockPlan;
  countries: CheckoutCountryLine[];
  networkLabel: string | null;
  tripSummary: CheckoutTripSummaryView;
}) {
  const lineTotal = plan.priceKrw * QTY;
  return (
    <>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">선택 상품</p>
      <p className="mt-2 text-[15px] font-bold leading-snug text-slate-900">{plan.nameKo}</p>
      {plan.dataSummaryKo ? <p className="mt-1 text-[12px] text-slate-600">{plan.dataSummaryKo}</p> : null}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-[11px] font-semibold text-slate-500">수량</p>
        <p className="mt-1 text-[14px] font-bold text-slate-900">{QTY}개</p>
      </div>
      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-[11px] font-semibold text-slate-500">여행 국가</p>
        {countries.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {countries.map((c) => (
              <li
                key={c.code}
                className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-800"
              >
                <span aria-hidden>{c.flag}</span>
                {c.nameKr}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12px] font-medium text-slate-500">표시할 국가 태그가 없어요.</p>
        )}
      </div>
      <div className="mt-4 border-t border-slate-100 pt-4 text-[12px]">
        <p className="text-[11px] font-semibold text-slate-500">여행 일정</p>
        <p className="mt-1 font-bold text-slate-900">
          {tripSummary.hasSchedule && tripSummary.startYmd && tripSummary.endYmd
            ? `${formatCheckoutDateDots(tripSummary.startYmd)} ~ ${formatCheckoutDateDots(tripSummary.endYmd)}`
            : `요금제 ${tripSummary.planValidityDays}일`}
        </p>
        {tripSummary.hasSchedule && tripSummary.days != null ? (
          <p className="mt-0.5 font-semibold text-slate-700">
            {tripSummary.days}일{tripSummary.nights != null ? ` · ${tripSummary.nights}박` : null}
          </p>
        ) : null}
      </div>
      {networkLabel ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-[11px] font-semibold text-slate-500">네트워크 유형</p>
          <p className="mt-1 text-[14px] font-bold text-teal-900">{networkLabel}</p>
        </div>
      ) : null}
      <div className="mt-5 space-y-1 border-t border-slate-200 pt-4">
        <p className="text-[11px] font-semibold text-slate-500">상품 금액 × {QTY}</p>
        <p className="text-[13px] font-bold tabular-nums text-slate-700">{formatKrw(plan.priceKrw)}</p>
        <p className="pt-2 text-[11px] font-semibold text-slate-500">최종 결제 금액</p>
        <p className="text-2xl font-black tabular-nums tracking-tight text-slate-900">{formatKrw(lineTotal)}</p>
      </div>
    </>
  );
}

export function CheckoutShell({
  plan,
  planId,
  countries,
  networkLabel,
  tripSummary,
  productBackHref,
  productBackLabel,
  datesAdjustHref,
  resultAdjustHref,
  childrenForm,
  payShell,
  desktopSummaryCta,
}: Props) {
  return (
    <div className="space-y-8 lg:space-y-10">
      <p className="lg:hidden">
        <Link
          href={productBackHref}
          className="inline-flex min-h-11 items-center gap-1 text-[14px] font-bold text-teal-900 underline-offset-4 hover:underline"
        >
          ← {productBackLabel}
        </Link>
      </p>
      <OrderTopSummary
        plan={plan}
        countries={countries}
        networkLabel={networkLabel}
        tripSummary={tripSummary}
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_min(19rem,34%)] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_min(20rem,32%)] xl:gap-12 2xl:gap-14">
        <div className="min-w-0 space-y-6 lg:space-y-7">
          <SectionCard
            eyebrow="선택 상품"
            title="상품 요약"
            subtitle="데이터 전용 eSIM이에요. 아래 금액은 모의 주문 기준이에요."
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold leading-snug text-slate-900">{plan.nameKo}</p>
                {plan.dataSummaryKo ? (
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{plan.dataSummaryKo}</p>
                ) : null}
                <p className="mt-3 text-[11px] font-medium text-slate-400">상품 코드 · {planId}</p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="text-[11px] font-semibold text-slate-500">수량</p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">{QTY}개</p>
                <p className="mt-3 text-[11px] font-semibold text-slate-500">단가</p>
                <p className="mt-0.5 text-xl font-black tabular-nums text-slate-900">{formatKrw(plan.priceKrw)}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-5 text-[12px] font-bold">
              <Link href={productBackHref} className="text-teal-800 underline-offset-2 hover:underline">
                {productBackLabel}
              </Link>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="여행 정보"
            title="일정·경로 요약"
            subtitle="표시 전용이에요. 변경은 이전 단계에서만 할 수 있어요."
          >
            <ul className="space-y-4">
              <li className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-6">
                <span className="w-28 shrink-0 text-[12px] font-bold text-slate-500">여행 국가</span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                  {countries.length > 0 ? (
                    countries.map((c) => (
                      <span
                        key={c.code}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2 text-[14px] font-bold text-slate-900"
                      >
                        <span className="text-xl leading-none" aria-hidden>
                          {c.flag}
                        </span>
                        {c.nameKr}
                      </span>
                    ))
                  ) : (
                    <span className="text-[13px] font-semibold text-slate-500">국가·지역 정보 없음</span>
                  )}
                </div>
              </li>
              <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="w-28 shrink-0 text-[12px] font-bold text-slate-500">여행 기간</span>
                <span className="text-[14px] font-bold text-slate-900">
                  {tripSummary.hasSchedule && tripSummary.startYmd && tripSummary.endYmd ? (
                    <>
                      {formatCheckoutDateDots(tripSummary.startYmd)} ~ {formatCheckoutDateDots(tripSummary.endYmd)}
                    </>
                  ) : (
                    <span className="text-slate-600">퍼널 일정 없음 · 요금제 {tripSummary.planValidityDays}일</span>
                  )}
                </span>
              </li>
              <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="w-28 shrink-0 text-[12px] font-bold text-slate-500">여행 일정</span>
                <span className="text-[14px] font-bold text-slate-900">
                  {tripSummary.hasSchedule && tripSummary.days != null ? (
                    <>
                      {tripSummary.days}일
                      {tripSummary.nights != null ? ` · ${tripSummary.nights}박` : null}
                      <span className="ml-2 text-[12px] font-semibold text-slate-500">
                        · 적용 요금제 {tripSummary.planValidityDays}일
                      </span>
                    </>
                  ) : (
                    <>요금제 {tripSummary.planValidityDays}일 기준</>
                  )}
                </span>
              </li>
              {networkLabel ? (
                <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
                  <span className="w-28 shrink-0 text-[12px] font-bold text-slate-500">네트워크 유형</span>
                  <span className="text-[14px] font-bold text-teal-900">{networkLabel}</span>
                </li>
              ) : null}
            </ul>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-5 text-[12px] font-bold text-teal-800">
              <Link href={datesAdjustHref} className="underline-offset-2 hover:underline">
                일정 변경하기
              </Link>
              <Link href={resultAdjustHref} className="underline-offset-2 hover:underline">
                비교 결과로
              </Link>
            </div>
          </SectionCard>

          <SectionCard eyebrow="주문 정보" title="연락처" subtitle="개통·안내 문자에 쓸 정보예요. 데모에서는 브라우저에만 잠깐 저장돼요.">
            <div className="lg:max-w-md xl:max-w-lg">{childrenForm}</div>
          </SectionCard>

          <SectionCard eyebrow="결제 수단" title="결제" subtitle="실제 카드사·간편결제 연동은 없어요. UI만 준비된 상태예요.">
            {payShell}
          </SectionCard>
        </div>

        <aside className="mt-8 hidden min-w-0 lg:sticky lg:top-24 lg:mt-0 lg:block lg:self-start">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 ring-1 ring-slate-100/90 xl:p-7">
            <AsideSummary
              plan={plan}
              countries={countries}
              networkLabel={networkLabel}
              tripSummary={tripSummary}
            />
            <div className="mt-6 border-t border-slate-100 pt-6">{desktopSummaryCta}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
