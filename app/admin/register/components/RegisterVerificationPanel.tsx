'use client'

import { OVERSEAS_SUPPLIER_LABEL } from '@/lib/normalize-supplier-origin'
import { normalizeBrandKeyToCanonicalSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import type { RegisterVerificationV1 as RegisterVerificationV1H } from '@/lib/admin-register-verification-meta-hanatour'
import type { RegisterVerificationV1 as RegisterVerificationV1M } from '@/lib/admin-register-verification-meta-modetour'
import type { RegisterVerificationV1 as RegisterVerificationV1V } from '@/lib/admin-register-verification-meta-verygoodtour'
import type { RegisterVerificationV1 as RegisterVerificationV1Y } from '@/lib/admin-register-verification-meta-ybtour'
import type { RegisterVerificationV1 as RegisterVerificationV1K } from '@/lib/admin-register-verification-meta-kyowontour'
import type { RegisterVerificationV1 as RegisterVerificationV1Lt } from '@/lib/admin-register-verification-meta-lottetour'

type RegisterVerificationV1 =
  | RegisterVerificationV1H
  | RegisterVerificationV1M
  | RegisterVerificationV1V
  | RegisterVerificationV1Y
  | RegisterVerificationV1K
  | RegisterVerificationV1Lt

type Props = {
  verification: RegisterVerificationV1
  /** confirm 시 미리보기에서 받은 fingerprint와 비교 */
  compareFingerprint?: string | null
  onOpenCorrection?: (field: string) => void
}

function fmtWon(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${Number(n).toLocaleString('ko-KR')}원`
}

export default function RegisterVerificationPanel({ verification, compareFingerprint, onOpenCorrection }: Props) {
  const { debug, display, publicSourceHints, fieldIssueTraces, structuredFingerprint, fingerprintCompareNote } =
    verification
  const verificationBrandCanon = normalizeBrandKeyToCanonicalSupplierKey(verification.brandKey)
  const verificationBrandSummaryLabel = verificationBrandCanon
    ? OVERSEAS_SUPPLIER_LABEL[verificationBrandCanon]
    : verification.brandKey
  const fpMatch =
    compareFingerprint != null && compareFingerprint !== ''
      ? compareFingerprint === structuredFingerprint
      : null

  return (
    <details className="rounded-lg border border-violet-300 bg-violet-50/90 text-xs text-violet-950 shadow-sm open:shadow">
      <summary className="cursor-pointer select-none px-3 py-2 font-bold text-violet-900">
        실검증 패널 · {verification.phase === 'preview' ? '미리보기' : '저장 직후'} ({verificationBrandSummaryLabel} ·{' '}
        <span className="font-mono font-normal">{verification.brandKey}</span>)
      </summary>
      <div className="space-y-3 border-t border-violet-200 px-3 py-3">
        <div className="rounded border border-violet-200 bg-white/90 p-2">
          <p className="font-semibold text-violet-900">라우팅·디버그</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-violet-800/95">
            <li>
              route: <code className="rounded bg-violet-100 px-1">{verification.route}</code>
            </li>
            <li>
              handler: <code className="rounded bg-violet-100 px-1">{verification.handler}</code>
            </li>
            <li>flightRaw: {debug.hasFlightRaw ? '있음' : '없음'}</li>
            <li>
              flightStructured: {debug.hasFlightStructured ? `있음 (${debug.flightStructuredStatus ?? 'status?'})` : '없음'}
            </li>
            <li>hotel rows: {debug.hotelRowCount}</li>
            <li>optional rows: {debug.optionalRowCount}</li>
            <li>shopping rows: {debug.shoppingRowCount}</li>
            <li>shopping visitCount: {debug.shoppingVisitCount ?? '—'}</li>
            <li>
              가격 슬롯: {debug.priceSlotLabels === 'modetour_4slot' ? '모두 4슬롯' : '기본(성인·아동베드·아동노베·유아 컬럼)'}
            </li>
            <li>
              productPriceTable: 성인 {fmtWon(debug.productPriceTable.adultPrice)} · 엑베{' '}
              {fmtWon(debug.productPriceTable.childExtraBedPrice)} · 노베 {fmtWon(debug.productPriceTable.childNoBedPrice)}{' '}
              · 유아 {fmtWon(debug.productPriceTable.infantPrice)}
            </li>
          </ul>
        </div>

        <div className="rounded border border-violet-200 bg-white/90 p-2">
          <p className="font-semibold text-violet-900">structuredFingerprint</p>
          <p className="mt-1 font-mono text-[11px]">{structuredFingerprint}</p>
          <p className="mt-1 text-[11px] text-violet-800/90">{fingerprintCompareNote}</p>
          {fpMatch != null ? (
            <p className={`mt-1 text-[11px] font-semibold ${fpMatch ? 'text-emerald-700' : 'text-amber-800'}`}>
              미리보기 fingerprint 대비: {fpMatch ? '일치' : '불일치 (교정·일정 키워드 등으로 parsed가 바뀌었을 수 있음)'}
            </p>
          ) : null}
        </div>

        {verification.productId ? (
          <div className="rounded border border-violet-200 bg-white/90 p-2">
            <p className="font-semibold text-violet-900">저장된 product</p>
            <p className="mt-1 font-mono text-[11px]">{verification.productId}</p>
            {verification.storedStructuredSignalsPreview ? (
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-900/90 p-2 text-[10px] text-slate-100">
                {JSON.stringify(verification.storedStructuredSignalsPreview, null, 2)}
              </pre>
            ) : (
              <p className="mt-1 text-[11px] text-violet-700">rawMeta structuredSignals 요약 없음</p>
            )}
          </div>
        ) : null}

        <div className="rounded border border-violet-200 bg-white/90 p-2">
          <p className="font-semibold text-violet-900">항공 (미리보기·저장 SSOT와 동일 parsed 기준)</p>
          <ul className="mt-1 space-y-0.5 text-[11px]">
            <li>항공사: {display.flight.airlineName ?? '—'}</li>
            <li>출발편 편명: {display.flight.outboundFlightNo ?? '—'}</li>
            <li>귀국편 편명: {display.flight.inboundFlightNo ?? '—'}</li>
            <li>가는편 한 줄: {display.flight.departureSegmentText ?? '—'}</li>
            <li>오는편 한 줄: {display.flight.returnSegmentText ?? '—'}</li>
            <li>
              출국: {display.flight.outboundDepartureAirport ?? '—'} → {display.flight.outboundArrivalAirport ?? '—'} /{' '}
              {display.flight.outboundDepartureAt ?? '—'} ~ {display.flight.outboundArrivalAt ?? '—'}
            </li>
            <li>
              입국: {display.flight.inboundDepartureAirport ?? '—'} → {display.flight.inboundArrivalAirport ?? '—'} /{' '}
              {display.flight.inboundDepartureAt ?? '—'} ~ {display.flight.inboundArrivalAt ?? '—'}
            </li>
          </ul>
        </div>

        <div className="rounded border border-violet-200 bg-white/90 p-2">
          <p className="font-semibold text-violet-900">호텔 행 (최대 15)</p>
          {display.hotelRows.length === 0 ? (
            <p className="mt-1 text-[11px] text-violet-700">행 없음</p>
          ) : (
            <div className="mt-1 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse border border-violet-200 text-[11px]">
                <thead>
                  <tr className="bg-violet-100/80">
                    <th className="border border-violet-200 px-1.5 py-1 text-left">일차</th>
                    <th className="border border-violet-200 px-1.5 py-1 text-left">날짜</th>
                    <th className="border border-violet-200 px-1.5 py-1 text-left">도시</th>
                    <th className="border border-violet-200 px-1.5 py-1 text-left">호텔명</th>
                    <th className="border border-violet-200 px-1.5 py-1 text-left">예정/확정</th>
                  </tr>
                </thead>
                <tbody>
                  {display.hotelRows.map((r, i) => (
                    <tr key={i}>
                      <td className="border border-violet-100 px-1.5 py-1">{r.dayLabel || '—'}</td>
                      <td className="border border-violet-100 px-1.5 py-1">{r.dateText || '—'}</td>
                      <td className="border border-violet-100 px-1.5 py-1">{r.cityText || '—'}</td>
                      <td className="border border-violet-100 px-1.5 py-1">{r.hotelNameText || '—'}</td>
                      <td className="border border-violet-100 px-1.5 py-1">{r.bookingStatusText || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded border border-violet-200 bg-white/90 p-2">
          <p className="font-semibold text-violet-900">선택관광 (최대 12)</p>
          {display.optionalRows.length === 0 ? (
            <p className="mt-1 text-[11px] text-violet-700">행 없음</p>
          ) : (
            <ul className="mt-1 space-y-1 text-[11px]">
              {display.optionalRows.map((r, i) => (
                <li key={i} className="rounded border border-violet-100 bg-violet-50/50 px-2 py-1">
                  <span className="font-medium">{r.tourName || '(이름 없음)'}</span> · 성인 {fmtWon(r.adultPrice)} · 소요시간{' '}
                  {r.durationText || '—'}
                  {r.minPaxText != null && String(r.minPaxText).trim() !== ''
                    ? ` · 최소행사인원 ${String(r.minPaxText).trim()}`
                    : ''}
                  {r.alternateScheduleText != null && String(r.alternateScheduleText).trim() !== ''
                    ? ` · 대체일정 ${String(r.alternateScheduleText).trim()}`
                    : ''}
                  {' · 동행 '}
                  {r.guide同行Text || '—'} · 대기 {r.waitingPlaceText || '—'}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded border border-violet-200 bg-white/90 p-2">
          <p className="font-semibold text-violet-900">쇼핑</p>
          <p className="mt-1 text-[11px]">
            방문 횟수(SSOT·본문 쇼핑 N회): {display.shopping.visitCount ?? '—'} · 표 행 수(후보·≠회수):{' '}
            {display.shopping.rowCount}
          </p>
          {display.shopping.rows.length === 0 ? (
            <p className="mt-1 text-[11px] text-violet-700">행 없음</p>
          ) : verification.brandKey === 'hanatour' ? (
            <div className="mt-1 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse border border-violet-200 text-[11px]">
                <thead>
                  <tr className="bg-violet-100/80">
                    <th className="border border-violet-200 px-1.5 py-1 text-left">도시</th>
                    <th className="border border-violet-200 px-1.5 py-1 text-left">쇼핑샵명(위치)</th>
                    <th className="border border-violet-200 px-1.5 py-1 text-left">품목</th>
                    <th className="border border-violet-200 px-1.5 py-1 text-left">소요시간</th>
                  </tr>
                </thead>
                <tbody>
                  {display.shopping.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="border border-violet-100 px-1.5 py-1 align-top">{r.city ?? '—'}</td>
                      <td className="border border-violet-100 px-1.5 py-1 align-top">
                        {[r.shopName, r.shopLocation].filter((x) => String(x ?? '').trim()).join(' ') ||
                          r.shoppingPlace ||
                          '—'}
                      </td>
                      <td className="border border-violet-100 px-1.5 py-1 align-top">
                        {(r.itemsText ?? r.shoppingItem) || '—'}
                      </td>
                      <td className="border border-violet-100 px-1.5 py-1 align-top">{r.durationText || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="mt-1 space-y-1 text-[11px]">
              {display.shopping.rows.map((r, i) => (
                <li key={i} className="rounded border border-violet-100 px-2 py-1">
                  <span className="font-medium">{r.city ?? '—'}</span> · {r.shopName ?? '—'} · {r.shopLocation ?? '—'}
                  <div className="mt-0.5">
                    품목: {(r.itemsText ?? r.shoppingItem) || '—'} · 소요 {r.durationText || '—'} · 환불{' '}
                    {r.refundPolicyText || '—'}
                  </div>
                  {r.noteText?.includes('__hanatour_shopping_row_issue__') ? (
                    <div className="mt-0.5 text-amber-900">
                      이슈: {r.noteText.replace(/^__hanatour_shopping_row_issue__:\s*/i, '')}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded border border-violet-200 bg-white/90 p-2">
          <p className="font-semibold text-violet-900">공개 상세 비교 시 볼 필드 (요약)</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] text-violet-900/90">
            <li>{publicSourceHints.flight}</li>
            <li>{publicSourceHints.price}</li>
            <li>{publicSourceHints.hotel}</li>
            <li>{publicSourceHints.optional}</li>
            <li>{publicSourceHints.shopping}</li>
          </ul>
        </div>

        <div className="rounded border border-amber-200 bg-amber-50/90 p-2">
          <p className="font-semibold text-amber-950">검수 이슈 → 추적 힌트 (교정 팝업과 함께 확인)</p>
          {fieldIssueTraces.length === 0 ? (
            <p className="mt-1 text-[11px] text-amber-900/90">이슈 없음</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {fieldIssueTraces.map((t, i) => (
                <li key={`${t.field}_${i}`} className="rounded border border-amber-200/80 bg-white/80 p-2 text-[11px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {t.field}{' '}
                      <span className="font-normal text-amber-800/90">
                        ({t.severity} · {t.source})
                      </span>
                    </span>
                    {onOpenCorrection ? (
                      <button
                        type="button"
                        onClick={() => onOpenCorrection(t.field)}
                        className="rounded border border-amber-700/40 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-950 hover:bg-amber-200"
                      >
                        교정 열기
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-1 text-amber-950/95">{t.reason}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-amber-900/85">{t.traceHint}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  )
}
