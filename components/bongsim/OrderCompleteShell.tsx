"use client";

import { bongsimPath } from '@/lib/bongsim/constants'
import type { ReactNode } from "react";
import Link from "next/link";
import type { CheckoutCountryLine, CheckoutTripSummaryView } from "@/lib/bongsim/checkout-display";
import { formatCheckoutDateDots } from "@/lib/bongsim/checkout-display";
import { StickyPurchaseBar } from "@/components/bongsim/StickyPurchaseBar";
import { SimplyurTeaserBanner } from "@/components/bongsim/SimplyurTeaserBanner";
import type { MockOrder, MockPlan } from "@/lib/bongsim/types";

const QTY = 1;

function formatKrw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

function SectionCard({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100/80 sm:p-6 lg:rounded-3xl lg:p-7">
      <p className="text-[11px] font-bold uppercase tracking-wide text-teal-800">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">{title}</h2>
      {subtitle ? <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{subtitle}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function CompletionHeader() {
  return (
    <header className="overflow-hidden rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50/90 via-white to-white p-6 shadow-md ring-1 ring-teal-100/70 sm:p-8 lg:p-10">
      <div className="flex flex-col items-center text-center lg:flex-row lg:items-start lg:gap-6 lg:text-left">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-2xl font-bold text-white shadow-lg shadow-teal-900/20"
          aria-hidden
        >
          ✓
        </div>
        <div className="mt-5 min-w-0 flex-1 lg:mt-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-800">STEP 7 · 완료</p>
          <h1 className="mt-1.5 text-[1.35rem] font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl lg:text-[1.65rem]">
            구매가 완료되었어요
          </h1>
          <p className="mt-2 text-[14px] font-semibold text-teal-900">주문이 정상적으로 접수되었습니다</p>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-slate-600 lg:text-[14px]">
            데모에서는 이 브라우저에만 저장되며, 실제 결제·발송·QR 발급은 진행되지 않아요.
          </p>
        </div>
      </div>
    </header>
  );
}

function AsideSummary({
  order,
  plan,
  countries,
  networkLabel,
  tripSummary,
}: {
  order: MockOrder;
  plan: MockPlan | undefined;
  countries: CheckoutCountryLine[];
  networkLabel: string | null;
  tripSummary: CheckoutTripSummaryView | null;
}) {
  const lineTotal = plan ? plan.priceKrw * QTY : 0;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 ring-1 ring-slate-100/90 xl:p-7">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">구매 요약</p>
      <dl className="mt-4 space-y-3 text-[13px]">
        <div>
          <dt className="font-semibold text-slate-500">주문 번호</dt>
          <dd className="mt-0.5 break-all font-mono text-[12px] font-bold text-slate-900">{order.orderId}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">접수 시각</dt>
          <dd className="mt-0.5 font-semibold text-slate-800">
            {new Date(order.createdAtIso).toLocaleString("ko-KR")}
          </dd>
        </div>
        {plan ? (
          <>
            <div>
              <dt className="font-semibold text-slate-500">선택 상품</dt>
              <dd className="mt-0.5 break-words font-bold leading-snug text-slate-900">{plan.nameKo}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">수량</dt>
              <dd className="mt-0.5 font-bold text-slate-800">{QTY}개</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">결제 금액</dt>
              <dd className="mt-0.5">
                <p className="text-[12px] font-semibold tabular-nums text-slate-600">
                  {formatKrw(plan.priceKrw)} × {QTY}
                </p>
                <p className="mt-1 text-lg font-black tabular-nums text-slate-900">{formatKrw(lineTotal)}</p>
              </dd>
            </div>
          </>
        ) : null}
        <div>
          <dt className="font-semibold text-slate-500">국가·지역</dt>
          <dd className="mt-2 flex flex-wrap gap-1.5">
            {countries.length > 0 ? (
              countries.map((c) => (
                <span
                  key={c.code}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-800"
                >
                  <span aria-hidden>{c.flag}</span>
                  {c.nameKr}
                </span>
              ))
            ) : (
              <span className="text-[12px] font-medium text-slate-500">표시할 지역 태그가 없어요.</span>
            )}
          </dd>
        </div>
        {tripSummary ? (
          <div>
            <dt className="font-semibold text-slate-500">여행 기간</dt>
            <dd className="mt-1 font-semibold text-slate-800">
              {tripSummary.hasSchedule && tripSummary.startYmd && tripSummary.endYmd ? (
                <>
                  {formatCheckoutDateDots(tripSummary.startYmd)} ~ {formatCheckoutDateDots(tripSummary.endYmd)}
                </>
              ) : (
                <span className="text-slate-600">일정 미연동</span>
              )}
            </dd>
            {tripSummary.hasSchedule && tripSummary.days != null ? (
              <dd className="mt-1 text-[12px] font-bold text-slate-700">
                {tripSummary.days}일
                {tripSummary.nights != null ? ` · ${tripSummary.nights}박` : null}
              </dd>
            ) : (
              <dd className="mt-1 text-[12px] text-slate-600">요금제 {tripSummary.planValidityDays}일 기준</dd>
            )}
          </div>
        ) : null}
        {networkLabel ? (
          <div>
            <dt className="font-semibold text-slate-500">네트워크 유형</dt>
            <dd className="mt-0.5 font-bold text-teal-900">{networkLabel}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

type Props = {
  order: MockOrder;
  plan: MockPlan | undefined;
  countries: CheckoutCountryLine[];
  networkLabel: string | null;
  tripSummary: CheckoutTripSummaryView | null;
};

export function OrderCompleteShell({ order, plan, countries, networkLabel, tripSummary }: Props) {
  const productHref = plan ? bongsimPath(`/product/${encodeURIComponent(plan.id)}`) : bongsimPath();
  const lineTotal = plan ? plan.priceKrw * QTY : null;

  return (
    <div className="space-y-8 pb-40 lg:space-y-10 lg:pb-10">
      <CompletionHeader />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_min(19rem,34%)] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_min(20rem,32%)] xl:gap-12 2xl:gap-14">
        <div className="min-w-0 space-y-6 lg:space-y-7">
          <SectionCard
            eyebrow="구매 요약"
            title="주문한 eSIM"
            subtitle="접수된 상품·금액을 한 번 더 확인해 주세요."
          >
            <dl className="space-y-4 text-[14px]">
              <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="shrink-0 font-semibold text-slate-500">주문 번호</dt>
                <dd className="break-all font-mono text-[12px] font-bold text-slate-900 sm:text-right sm:text-sm">
                  {order.orderId}
                </dd>
              </div>
              <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="shrink-0 font-semibold text-slate-500">접수 시각</dt>
                <dd className="font-semibold text-slate-900 sm:text-right">
                  {new Date(order.createdAtIso).toLocaleString("ko-KR")}
                </dd>
              </div>
              {plan ? (
                <>
                  <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="shrink-0 font-semibold text-slate-500">상품명</dt>
                    <dd className="break-words text-right font-bold leading-snug text-slate-900 sm:max-w-[60%]">
                      {plan.nameKo}
                    </dd>
                  </div>
                  {plan.dataSummaryKo ? (
                    <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:justify-between sm:gap-4">
                      <dt className="shrink-0 font-semibold text-slate-500">데이터·요금</dt>
                      <dd className="text-right text-[13px] font-medium text-slate-700 sm:max-w-[60%]">
                        {plan.dataSummaryKo}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="shrink-0 font-semibold text-slate-500">수량</dt>
                    <dd className="text-right font-bold text-slate-900 sm:max-w-[60%]">{QTY}개</dd>
                  </div>
                  <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                    <dt className="shrink-0 font-semibold text-slate-500">상품 금액</dt>
                    <dd className="text-right text-lg font-black tabular-nums text-slate-900 sm:max-w-[60%]">
                      {formatKrw(plan.priceKrw)} × {QTY}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                    <dt className="shrink-0 font-semibold text-slate-500">최종 결제 금액</dt>
                    <dd className="text-2xl font-black tabular-nums text-slate-900 sm:text-right">
                      {lineTotal != null ? formatKrw(lineTotal) : "—"}
                    </dd>
                  </div>
                </>
              ) : (
                <p className="text-[14px] text-slate-600">요금제 정보를 불러오지 못했어요.</p>
              )}
            </dl>
            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">연락처</p>
              <p className="mt-2 text-[14px] font-semibold text-slate-900">
                {order.customerName} · {order.customerPhone}
              </p>
              <p className="mt-1 break-all text-[13px] font-medium text-slate-700">{order.customerEmail}</p>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="여행 정보"
            title="일정·경로"
            subtitle="이번 주문에 반영된 여행 조건이에요."
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
                    <span className="text-[14px] text-slate-600">국가 정보가 없어요.</span>
                  )}
                </div>
              </li>
              <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="w-28 shrink-0 text-[12px] font-bold text-slate-500">여행 기간</span>
                <span className="text-[14px] font-bold text-slate-900">
                  {tripSummary?.hasSchedule && tripSummary.startYmd && tripSummary.endYmd ? (
                    <>
                      {formatCheckoutDateDots(tripSummary.startYmd)} ~{" "}
                      {formatCheckoutDateDots(tripSummary.endYmd)}
                    </>
                  ) : (
                    <span className="font-semibold text-slate-600">
                      퍼널 일정 없음
                      {tripSummary ? ` · 요금제 ${tripSummary.planValidityDays}일` : ""}
                    </span>
                  )}
                </span>
              </li>
              <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="w-28 shrink-0 text-[12px] font-bold text-slate-500">여행 일정</span>
                <span className="text-[14px] font-bold text-slate-900">
                  {tripSummary?.hasSchedule && tripSummary.days != null ? (
                    <>
                      {tripSummary.days}일
                      {tripSummary.nights != null ? ` · ${tripSummary.nights}박` : null}
                      {tripSummary.planValidityDays ? (
                        <span className="ml-2 text-[12px] font-semibold text-slate-500">
                          · 적용 요금제 {tripSummary.planValidityDays}일
                        </span>
                      ) : null}
                    </>
                  ) : tripSummary ? (
                    <>요금제 {tripSummary.planValidityDays}일 기준</>
                  ) : (
                    "—"
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
          </SectionCard>

          <SectionCard
            eyebrow="QR / 개통 정보"
            title="개통 자료 표시 영역"
            subtitle="연동 후 이 영역에 QR·설치 링크·개통 상태가 정리됩니다. 지금은 레이아웃만 준비된 상태예요."
          >
            <div
              className="rounded-2xl border border-teal-100 bg-gradient-to-b from-teal-50/40 to-white px-5 py-10 text-center ring-1 ring-teal-50 sm:px-8"
              aria-label="QR 및 개통 정보 표시 예정 영역"
            >
              <p className="text-[14px] font-bold text-slate-900">QR 및 개통 정보</p>
              <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-slate-600">
                구매 후 확인 가능한 정보가 이곳에 표시됩니다. 실서비스에서는 시스템 연동으로 QR 이미지 또는
                등록 링크를 제공해요. 데모에서는 생성·스캔 기능을 넣지 않았어요.
              </p>
              <div className="mx-auto mt-6 h-36 max-w-xs rounded-xl border-2 border-dashed border-teal-200/80 bg-white/60" />
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="다음에 할 일"
            title="설치·이용 안내"
            subtitle="지금은 데모라 QR은 없지만, 실서비스에서는 아래 순서로 안내할 수 있어요."
          >
            <ol className="list-none space-y-4">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[12px] font-black text-teal-900">
                  1
                </span>
                <div>
                  <p className="text-[14px] font-bold text-slate-900">설치·설정 가이드</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                    기기에 eSIM을 추가하는 방법과 유의할 점을 먼저 확인해 주세요.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[12px] font-black text-teal-900">
                  2
                </span>
                <div>
                  <p className="text-[14px] font-bold text-slate-900">QR · 개통 정보</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                    연동 후 이 페이지 또는 메일에서 설치용 자료를 받게 돼요.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[12px] font-black text-teal-900">
                  3
                </span>
                <div>
                  <p className="text-[14px] font-bold text-slate-900">문의가 필요할 때</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                    문제가 있으면 주문 번호와 함께 고객지원으로 연락해 주세요.
                  </p>
                </div>
              </li>
            </ol>
            <div className="mt-6">
              <Link
                href={bongsimPath("/help/setup-guide")}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-teal-700 px-4 text-[15px] font-bold text-white shadow-md transition hover:bg-teal-800"
              >
                설치·설정 안내 보기
              </Link>
            </div>
          </SectionCard>

          <section
            id="support"
            className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100/80 sm:p-6 lg:rounded-3xl lg:p-7"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-800">둘러보기</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">다음 이동</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
              이 주소를 북마크해 두면 같은 브라우저에서 주문 요약을 다시 열 수 있어요.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href={bongsimPath()}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-teal-700 px-4 text-[14px] font-bold text-white shadow-md transition hover:bg-teal-800 sm:col-span-2"
              >
                홈으로
              </Link>
              <Link
                href={bongsimPath("/help/customer-support")}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-[14px] font-bold text-slate-800 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/50"
              >
                고객지원
              </Link>
              <Link
                href={bongsimPath("/help/service-help")}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-[14px] font-bold text-slate-800 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/50"
              >
                서비스 도움말
              </Link>
              <Link
                href={productHref}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-teal-200 bg-teal-50/70 px-4 text-[14px] font-bold text-teal-900 transition hover:bg-teal-100 sm:col-span-2"
              >
                주문 상품 상세
              </Link>
            </div>
            <p className="mt-5 text-center text-[12px] leading-relaxed text-slate-500 sm:text-left">
              <Link href={bongsimPath("/recommend")} className="font-semibold text-teal-800 underline-offset-2 hover:underline">
                새로 추천 받기
              </Link>
              <span className="text-slate-400"> · </span>
              처음부터 맞춤 추천 흐름으로 돌아가요.
            </p>
            <p className="mt-2 text-center text-[12px] leading-relaxed text-slate-400 sm:text-left">
              1:1 채팅·전화 상담은 서비스 연동 후 제공할 수 있어요.
            </p>
          </section>
          <SimplyurTeaserBanner variant="card" />
        </div>

        <aside className="mt-8 hidden min-w-0 lg:sticky lg:top-24 lg:mt-0 lg:block lg:self-start">
          <AsideSummary
            order={order}
            plan={plan}
            countries={countries}
            networkLabel={networkLabel}
            tripSummary={tripSummary}
          />
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/90 p-5">
            <p className="text-[12px] font-bold text-slate-800">도움말</p>
            <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
              문의 시 주문 번호를 알려 주시면 빠르게 확인할 수 있어요.
            </p>
            <Link
              href={bongsimPath("/help/setup-guide")}
              className="mt-4 inline-flex min-h-10 items-center text-[13px] font-bold text-teal-800 underline-offset-2 hover:underline"
            >
              설치·설정 안내 →
            </Link>
            <a
              href="#support"
              className="mt-2 inline-flex text-[13px] font-semibold text-slate-600 underline-offset-2 hover:underline"
            >
              다음 이동 영역으로
            </a>
          </div>
        </aside>
      </div>

      {plan ? (
        <StickyPurchaseBar
          variant="stacked-cta"
          priceKrw={plan.priceKrw * QTY}
          priceCaption="결제 완료 금액"
          primaryHref="/help/setup-guide"
          primaryLabel="설치·설정 안내"
          secondaryHref="/"
          secondaryLabel="홈으로"
          hideFromLarge
        />
      ) : null}
    </div>
  );
}
