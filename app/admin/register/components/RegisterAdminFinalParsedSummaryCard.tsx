'use client'

import type { KyowontourFinalParsed } from '@/lib/kyowontour-admin-preview-card-types'
import type { LottetourFinalParsed } from '@/lib/lottetour-admin-preview-card-types'

export type RegisterAdminFinalParsedSummary = KyowontourFinalParsed | LottetourFinalParsed

function fmtWon(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${Number(n).toLocaleString('ko-KR')}원`
}

type Props = {
  data: RegisterAdminFinalParsedSummary
}

/** 교원이지·롯데관광 미리보기 `data` — 구조화 요약과 별도로 카드용 요약을 보여 준다. */
export default function RegisterAdminFinalParsedSummaryCard({ data }: Props) {
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50/90 p-3 text-xs text-emerald-950 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">구조화 확인 카드 (미리보기 data)</p>
      <p className="mt-1 text-[11px] text-emerald-900/90">
        서버가 파싱·정규화한 요약입니다. 아래 「확인 요약」의 productDraft와 교차 검수하세요.
      </p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-medium text-emerald-800">상품명</dt>
          <dd className="font-semibold text-emerald-950">{data.title}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium text-emerald-800">상품코드</dt>
          <dd className="font-mono text-[11px]">{data.productCode || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium text-emerald-800">일정</dt>
          <dd>
            {data.durationLabel} · 예상 {data.expectedDayCount}일차
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium text-emerald-800">성인 / 아동(엑베) / 유아</dt>
          <dd className="tabular-nums">
            {fmtWon(data.priceAdult)} / {fmtWon(data.priceChild)} / {fmtWon(data.priceInfant)}
          </dd>
        </div>
        {data.fuelSurcharge != null && data.fuelSurcharge > 0 ? (
          <div>
            <dt className="text-[10px] font-medium text-emerald-800">유류할증(1차 샘플)</dt>
            <dd className="tabular-nums">{fmtWon(data.fuelSurcharge)}</dd>
          </div>
        ) : null}
        {data.meetingInfo?.location?.trim() ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-medium text-emerald-800">집결</dt>
            <dd className="whitespace-pre-wrap">{data.meetingInfo.location}</dd>
          </div>
        ) : null}
        {data.hotelGradeLabel?.trim() ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-medium text-emerald-800">호텔 등급</dt>
            <dd>{data.hotelGradeLabel}</dd>
          </div>
        ) : null}
      </dl>

      {data.flight ? (
        <div className="mt-3 rounded border border-emerald-200 bg-white/80 p-2">
          <p className="font-semibold text-emerald-900">항공 (data)</p>
          <p className="mt-1 text-[11px]">{data.flight.airline}</p>
          <p className="mt-1 text-[10px] text-emerald-900/90">
            가는편 {data.flight.outbound.flightNo} · {data.flight.outbound.departureDateTime} → {data.flight.outbound.arrivalDateTime}
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-900/90">
            오는편 {data.flight.inbound.flightNo} · {data.flight.inbound.departureDateTime} → {data.flight.inbound.arrivalDateTime}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-emerald-800/90">항공(data): 본 라운드에서는 비어 있음 — 실검증 패널·productDraft 항공을 우선 확인.</p>
      )}

      {data.schedule.length > 0 ? (
        <div className="mt-3 rounded border border-emerald-200 bg-white/80 p-2">
          <p className="font-semibold text-emerald-900">일정 요약 (data · 최대 8일)</p>
          <ul className="mt-1 space-y-1.5 text-[11px]">
            {data.schedule.slice(0, 8).map((d) => (
              <li key={d.dayNumber} className="rounded border border-emerald-100 px-2 py-1">
                <span className="font-medium">{d.dayNumber}일차</span>
                {d.title ? ` · ${d.title}` : ''}
                {d.hotel ? <span className="block text-[10px] text-emerald-800/95">숙소: {d.hotel}</span> : null}
                {d.meals ? (
                  <span className="block text-[10px] text-emerald-800/90">
                    식: 조{d.meals.breakfast || '—'} 중{d.meals.lunch || '—'} 석{d.meals.dinner || '—'}
                  </span>
                ) : null}
                {d.activities?.length ? (
                  <span className="mt-0.5 block whitespace-pre-wrap text-[10px] text-emerald-900/95">
                    {d.activities.join(' · ')}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold text-emerald-900">포함</p>
          <ul className="mt-1 list-inside list-disc text-[10px] text-emerald-950/95">
            {(data.includedItems ?? []).slice(0, 12).map((x, i) => (
              <li key={`inc_${i}`}>{x}</li>
            ))}
            {(data.includedItems?.length ?? 0) === 0 ? <li>—</li> : null}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-emerald-900">불포함</p>
          <ul className="mt-1 list-inside list-disc text-[10px] text-emerald-950/95">
            {(data.excludedItems ?? []).slice(0, 12).map((x, i) => (
              <li key={`exc_${i}`}>{x}</li>
            ))}
            {(data.excludedItems?.length ?? 0) === 0 ? <li>—</li> : null}
          </ul>
        </div>
      </div>

      {data.optionalTours.length > 0 ? (
        <div className="mt-3 rounded border border-emerald-200 bg-white/80 p-2">
          <p className="font-semibold text-emerald-900">선택관광 (data · {data.optionalTours.length}건)</p>
          <ul className="mt-1 space-y-1 text-[10px]">
            {data.optionalTours.slice(0, 8).map((o, i) => (
              <li key={`opt_${i}`}>
                <span className="font-medium">{o.name}</span> · 성인 {fmtWon(o.priceAdult)} · {o.duration || '—'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.shoppingItems.length > 0 ? (
        <div className="mt-3 rounded border border-emerald-200 bg-white/80 p-2">
          <p className="font-semibold text-emerald-900">쇼핑 (data · {data.shoppingItems.length}건)</p>
          <ul className="mt-1 space-y-1 text-[10px]">
            {data.shoppingItems.slice(0, 8).map((s, i) => (
              <li key={`shop_${i}`}>
                {s.itemName} · {s.shopLocation || '—'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.warnings.length > 0 ? (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50/90 p-2 text-[11px] text-amber-950">
          <p className="font-semibold">경고·정책 안내</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {data.warnings.map((w, i) => (
              <li key={`w_${i}`}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.originalBodyText?.trim() ? (
        <details className="mt-3 rounded border border-emerald-200 bg-white/70 p-2 text-[10px] text-emerald-900">
          <summary className="cursor-pointer font-semibold text-emerald-950">원문 스냅샷 (축약)</summary>
          <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-relaxed">
            {data.originalBodyText.length > 8000 ? `${data.originalBodyText.slice(0, 8000)}…` : data.originalBodyText}
          </pre>
        </details>
      ) : null}
    </div>
  )
}
