'use client'

import type { ReactNode } from 'react'
import { FLIGHT_FINAL_CONFIRM_HINT, formatDirectedFlightRow } from '@/lib/flight-user-display'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import { normalizeFlightLabelForPublicDisplay } from '@/lib/text-encoding-guard'
import type { ProductMetaChip } from '@/lib/product-meta-chips'
import { ProductMetaChips } from '@/app/components/detail/product-detail-visual'
import { resolveMeetingBlockForPublic } from '@/lib/meeting-line-dedupe'

const ROW =
  'flex flex-col gap-2 border-b border-bt-border-soft py-4 last:border-b-0 sm:flex-row sm:items-start sm:gap-6'
const LABEL = 'w-full shrink-0 text-xs font-bold uppercase tracking-[0.08em] text-bt-meta sm:w-28 sm:pt-0.5'
const VALUE = 'min-w-0 flex-1 text-sm font-medium leading-relaxed text-bt-title'

type Props = {
  facts: DepartureKeyFacts | null
  productAirline: string | null
  /** 여행기간 우측 값(날짜+박일) — duration 부분은 상위에서 강조 span 포함 가능 */
  periodContent: ReactNode
  travelCitiesLine: string
  reservationLine: string | null
  meetingDefault: string
  meetingExtra?: string | null
  metaChips: ProductMetaChip[]
  /**
   * 출발일 선택 모달이 열렸을 때 등 — 여행기간·항공·도시·예약인원 블록을 숨김(달력과 중복·혼동 방지).
   * 미팅·요약 칩·하단 안내는 유지.
   */
  omitBriefRows?: boolean
  flightExposurePolicy?: 'public_full' | 'public_limited' | 'admin_only' | null
}

function CoreRow({
  label,
  children,
  action,
}: {
  label: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={ROW}>
      <div className={LABEL}>{label}</div>
      <div className={`${VALUE} flex flex-wrap items-start justify-between gap-3`}>
        <div className="min-w-0 flex-1">{children}</div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  )
}

export default function TravelCoreInfoSection({
  facts,
  productAirline,
  periodContent,
  travelCitiesLine,
  reservationLine,
  meetingDefault,
  meetingExtra,
  metaChips,
  omitBriefRows = false,
  flightExposurePolicy = null,
}: Props) {
  const rawAirlineLine = (facts?.airline?.trim() || productAirline?.trim() || '').trim() || null
  const airlineLine = normalizeFlightLabelForPublicDisplay(rawAirlineLine)
  const ob = facts?.outbound
  const ib = facts?.inbound
  const outRow = formatDirectedFlightRow('가는편', ob)
  const inRow = formatDirectedFlightRow('오는편', ib)
  const showFlightHint = outRow.showFlightHint || inRow.showFlightHint
  const hasLegRows = Boolean(outRow.line || inRow.line)
  /** suppress_no_parsed 등 진짜 차단만 전면 숨김. public_limited인데 leg 추출 실패 시에도 항공사는 유지 */
  const effectiveFlightPolicy = flightExposurePolicy === 'admin_only' ? 'admin_only' : (flightExposurePolicy ?? 'public_full')
  const meetingBlock = resolveMeetingBlockForPublic(meetingDefault, meetingExtra ?? null)

  return (
    <section className="rounded-2xl border border-bt-border-strong bg-bt-surface p-5 shadow-sm sm:p-7">
      <h2 className="mb-1 border-l-4 border-bt-card-title pl-3 text-xl font-black tracking-tight text-bt-card-title sm:text-2xl">
        여행 핵심정보
      </h2>
      <p className="mb-4 pl-3 text-[11px] font-medium text-bt-meta">공급사별 원문·리스트는 내부에서 맞추고, 표시 형식은 동일합니다.</p>

      <div className="divide-y divide-bt-border-soft rounded-xl border border-bt-border-soft bg-bt-surface-soft/40 px-4 sm:px-5">
        {!omitBriefRows ? (
          <>
            <CoreRow label="여행기간">
              <div className="bt-wrap">{periodContent}</div>
            </CoreRow>

            <CoreRow label="항공여정">
              <div className="space-y-2">
                {effectiveFlightPolicy !== 'admin_only' && airlineLine ? (
                  <p className="text-sm font-semibold text-bt-card-title">항공사: {airlineLine}</p>
                ) : null}
                {effectiveFlightPolicy !== 'admin_only' && outRow.line ? (
                  <p className="bt-wrap text-sm leading-relaxed">{outRow.line}</p>
                ) : null}
                {effectiveFlightPolicy !== 'admin_only' && inRow.line ? (
                  <p className="bt-wrap text-sm leading-relaxed">{inRow.line}</p>
                ) : null}
                {effectiveFlightPolicy === 'admin_only' || (!outRow.line && !inRow.line) ? (
                  <p className="text-sm text-bt-muted">선택하신 출발일의 항공 일정은 상담 시 최종 안내드립니다.</p>
                ) : null}
                {effectiveFlightPolicy === 'public_limited' ? (
                  <p className="text-[10px] font-medium text-bt-muted">일부 항공 정보는 상담 시 최종 확인됩니다.</p>
                ) : showFlightHint ? (
                  <p className="text-[10px] font-medium text-bt-muted">{FLIGHT_FINAL_CONFIRM_HINT}</p>
                ) : null}
              </div>
            </CoreRow>

            <CoreRow label="여행도시">
              <p className="bt-wrap">{travelCitiesLine.trim() || '—'}</p>
            </CoreRow>

            <CoreRow label="예약인원">
              <p className="bt-wrap">{reservationLine?.trim() || '상담 시 안내'}</p>
            </CoreRow>
          </>
        ) : null}

        <CoreRow label="미팅정보">
          <div className="space-y-2">
            <p className="bt-wrap">{meetingBlock.line1}</p>
            {meetingBlock.line2 ? (
              <p className="bt-wrap text-sm text-bt-body">{meetingBlock.line2}</p>
            ) : null}
          </div>
        </CoreRow>
      </div>

      {metaChips.length > 0 ? (
        <div className="mt-5 border-t border-bt-border-soft pt-4">
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-bt-meta">여행 요약</p>
          <ProductMetaChips chips={metaChips} variant="light" className="justify-center" stackValueKinds={['freeTime', 'airline']} />
        </div>
      ) : null}

      <p className="bt-wrap mt-4 text-center text-[11px] text-bt-muted">
        선택하신 출발일에 따라 항공편·좌석·요금이 달라질 수 있습니다.
      </p>
    </section>
  )
}
