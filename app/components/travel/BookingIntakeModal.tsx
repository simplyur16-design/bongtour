'use client'

import { useEffect, useMemo, useState } from 'react'
import { validateBookingIntake } from '@/lib/booking-intake-contract'
import KakaoCounselCta from '@/app/components/travel/KakaoCounselCta'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_FORMAT_ERROR = '올바른 이메일 형식을 입력해 주세요.'

export type BookingPax = {
  adult: number
  childBed: number
  childNoBed: number
  infant: number
}

type Props = {
  open: boolean
  onClose: () => void
  productId: string
  productTitle: string
  originSource: string
  originCode: string
  /** 상세에서 고른 출발일 YYYY-MM-DD (일정이 있을 때) */
  selectedDateFromCalendar: string | null
  pax: BookingPax
  /** 가격 일정이 하나도 없으면 희망일만 접수 */
  hasPriceSchedule: boolean
}

type ApiSuccess = {
  ok: true
  bookingId: number
  message: string
  pricingMode?: 'schedule_price' | 'wish_date_only'
}

export default function BookingIntakeModal({
  open,
  onClose,
  productId,
  productTitle,
  originSource,
  originCode,
  selectedDateFromCalendar,
  pax,
  hasPriceSchedule,
}: Props) {
  const childCount = pax.childBed + pax.childNoBed
  const infantCount = pax.infant

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [singleRoomRequested, setSingleRoomRequested] = useState(false)
  const [preferredContactChannel, setPreferredContactChannel] = useState<'phone' | 'kakao' | 'email'>('phone')
  const [requestNotes, setRequestNotes] = useState('')

  /** schedule: 캘린더 선택일 + 선택적 추가 희망일 / wish: 희망일만 (일정 없으면 wish만) */
  const [departureMode, setDepartureMode] = useState<'schedule' | 'wish'>(() =>
    hasPriceSchedule ? 'schedule' : 'wish'
  )
  const [preferredDateOnly, setPreferredDateOnly] = useState('')
  const [additionalPreferredWhenSchedule, setAdditionalPreferredWhenSchedule] = useState('')

  const [birthDates, setBirthDates] = useState<string[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [clientError, setClientError] = useState('')
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState<ApiSuccess | null>(null)

  useEffect(() => {
    if (!open) return
    setClientError('')
    setServerError('')
    setSuccess(null)
    if (!hasPriceSchedule) {
      setDepartureMode('wish')
    } else {
      setDepartureMode('schedule')
    }
  }, [open, hasPriceSchedule])

  useEffect(() => {
    const n = childCount + infantCount
    setBirthDates((prev) => {
      const next = [...prev]
      while (next.length < n) next.push('')
      return next.slice(0, n)
    })
  }, [childCount, infantCount])

  const selectedDepartureDate = useMemo(() => {
    if (departureMode !== 'schedule') return null
    return selectedDateFromCalendar
  }, [departureMode, selectedDateFromCalendar])

  const preferredDepartureDate = useMemo(() => {
    if (departureMode === 'wish') {
      return preferredDateOnly.trim() || null
    }
    return additionalPreferredWhenSchedule.trim() || null
  }, [departureMode, preferredDateOnly, additionalPreferredWhenSchedule])

  const buildPayload = () => {
    const rows: { type: 'child' | 'infant'; birthDate: string }[] = []
    for (let i = 0; i < childCount; i++) {
      rows.push({ type: 'child', birthDate: birthDates[i]?.trim() ?? '' })
    }
    for (let j = 0; j < infantCount; j++) {
      rows.push({ type: 'infant', birthDate: birthDates[childCount + j]?.trim() ?? '' })
    }
    return {
      productId: String(productId),
      originSource,
      originCode,
      selectedDepartureDate: selectedDepartureDate,
      preferredDepartureDate,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim(),
      adultCount: pax.adult,
      childCount,
      childWithBedCount: pax.childBed,
      childNoBedCount: pax.childNoBed,
      infantCount,
      singleRoomRequested,
      preferredContactChannel,
      childInfantBirthDates: rows,
      requestNotes: requestNotes.trim() || null,
    }
  }

  const hasValidEmailFormat = (value: string): boolean => EMAIL_RE.test(value.trim())

  const runClientChecks = (): string | null => {
    if (departureMode === 'schedule' && hasPriceSchedule && !selectedDateFromCalendar) {
      return '상단에서 출발일을 선택하거나, “희망 출발일만”으로 접수해 주세요.'
    }
    if (departureMode === 'wish' && !preferredDateOnly.trim()) {
      return '희망 출발일을 입력해 주세요.'
    }
    if (departureMode === 'schedule' && hasPriceSchedule && selectedDateFromCalendar) {
      if (additionalPreferredWhenSchedule.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(additionalPreferredWhenSchedule.trim())) {
        return '추가 희망일은 YYYY-MM-DD 형식이어야 합니다.'
      }
    }
    if (departureMode === 'wish' && preferredDateOnly.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(preferredDateOnly.trim())) {
      return '희망 출발일은 YYYY-MM-DD 형식이어야 합니다.'
    }
    if (customerEmail.trim() && !hasValidEmailFormat(customerEmail)) {
      return EMAIL_FORMAT_ERROR
    }
    for (let i = 0; i < childCount + infantCount; i++) {
      const v = birthDates[i]?.trim() ?? ''
      if (!v) return '아동·유아 생년월일을 모두 입력해 주세요.'
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return '생년월일은 YYYY-MM-DD 형식이어야 합니다.'
    }
    const v = validateBookingIntake(buildPayload())
    if (!v.ok) return v.errors.join(' ')
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setClientError('')
    setServerError('')
    const ce = runClientChecks()
    if (ce) {
      setClientError(ce)
      return
    }
    const payload = buildPayload()
    const validated = validateBookingIntake(payload)
    if (!validated.ok) {
      setClientError(validated.errors.join(' '))
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        productId: validated.value.productId,
        originSource: validated.value.originSource,
        originCode: validated.value.originCode,
        website: '',
        customerName: validated.value.customerName,
        customerPhone: validated.value.customerPhone,
        customerEmail: validated.value.customerEmail,
        adultCount: validated.value.adultCount,
        childCount: validated.value.childCount,
        childWithBedCount: validated.value.childWithBedCount,
        childNoBedCount: validated.value.childNoBedCount,
        infantCount: validated.value.infantCount,
        singleRoomRequested: validated.value.singleRoomRequested,
        preferredContactChannel: validated.value.preferredContactChannel,
        childInfantBirthDates: validated.value.childInfantBirthDates,
        requestNotes: validated.value.requestNotes,
      }
      if (validated.value.selectedDepartureDate) {
        body.selectedDate = validated.value.selectedDepartureDate
        body.selectedDepartureDate = validated.value.selectedDepartureDate
      }
      if (validated.value.preferredDepartureDate) {
        body.preferredDepartureDate = validated.value.preferredDepartureDate
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { error?: string } & Partial<ApiSuccess>
      if (!res.ok) {
        setServerError(typeof data.error === 'string' ? data.error : '접수에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      if (data.ok && data.message) {
        setSuccess({
          ok: true,
          bookingId: data.bookingId ?? 0,
          message: data.message,
          pricingMode: data.pricingMode,
        })
        setCustomerName('')
        setCustomerPhone('')
        setCustomerEmail('')
        setRequestNotes('')
        setBirthDates([])
      } else {
        setServerError('응답 형식이 올바르지 않습니다.')
      }
    } catch {
      setServerError('네트워크 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <div className="max-h-[95vh] w-full overflow-y-auto border border-bt-border-soft bg-bt-surface p-5 shadow-lg sm:max-w-lg sm:rounded-lg">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-bt-title">예약 요청 접수</h3>
            <p className="mt-1 text-xs leading-relaxed text-bt-meta">
              자동 예약이 아닙니다. 정보를 남기시면 담당자가 확인 후 연락드립니다. 실제 예약·결제·혜택은 확인 후 안내됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-sm text-bt-meta hover:text-bt-strong"
          >
            닫기
          </button>
        </div>

        {success ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-bt-success bg-bt-badge-domestic p-4">
              <p className="text-sm font-medium text-bt-badge-domestic-text">요청이 접수되었습니다</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-bt-body">{success.message}</p>
              {success.pricingMode === 'wish_date_only' && (
                <p className="mt-3 rounded border border-bt-border-soft bg-bt-badge-freeform px-3 py-2 text-sm text-bt-badge-freeform-text">
                  희망 출발일 기준으로 접수되었습니다. 금액·좌석은 담당자 확인 후 안내됩니다.
                </p>
              )}
              {success.pricingMode === 'schedule_price' && (
                <p className="mt-2 text-xs text-bt-meta">
                  안내된 견적은 참고용이며, 최종 조건은 담당자 확인 후 확정됩니다.
                </p>
              )}
              <p className="mt-3 text-xs text-bt-meta">
                예약 확정이 아닙니다. 순차적으로 연락드리니 양해 부탁드립니다.
              </p>
            </div>
            <div className="rounded-lg border border-dashed border-bt-border-soft bg-bt-surface p-3">
              <p className="text-xs font-medium text-bt-body">추가 문의</p>
              <p className="mt-1 text-[11px] leading-relaxed text-bt-meta">
                접수와 별도로 상품·일정을 바로 물어보시려면 카카오 상담으로 연결할 수 있습니다.
              </p>
              <div className="mt-2">
                <KakaoCounselCta
                  variant="kakaoSoft"
                  showHelper
                  intent="booking"
                  fromScreen="booking_success_modal"
                  productId={productId}
                  productTitle={productTitle}
                  originSource={originSource}
                  originCode={originCode}
                  selectedDepartureDate={selectedDepartureDate}
                  preferredDepartureDate={preferredDepartureDate}
                  pax={pax}
                  bookingId={success.bookingId}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full border border-bt-cta-primary bg-bt-cta-primary py-2.5 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover"
            >
              확인
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              name="website"
              value=""
              readOnly
              autoComplete="off"
              tabIndex={-1}
              aria-hidden="true"
              className="hidden"
            />
            {hasPriceSchedule && (
              <div className="space-y-2 rounded-lg border border-bt-border-soft bg-bt-surface-alt p-3">
                <p className="text-xs font-medium text-bt-body">출발일</p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="depMode"
                    checked={departureMode === 'schedule'}
                    onChange={() => setDepartureMode('schedule')}
                    className="mt-1"
                  />
                  <span>
                    상품 일정에서 선택한 날짜로 접수
                    {selectedDateFromCalendar ? (
                      <span className="ml-1 font-medium text-bt-title">({selectedDateFromCalendar})</span>
                    ) : (
                      <span className="ml-1 text-bt-warning"> — 상단에서 출발일을 먼저 선택해 주세요.</span>
                    )}
                  </span>
                </label>
                {departureMode === 'schedule' && selectedDateFromCalendar && (
                  <div className="pl-6">
                    <label htmlFor="booking-add-pref" className="text-xs text-bt-muted">
                      추가 희망일 (선택, YYYY-MM-DD)
                    </label>
                    <input
                      id="booking-add-pref"
                      type="date"
                      value={additionalPreferredWhenSchedule}
                      onChange={(e) => setAdditionalPreferredWhenSchedule(e.target.value)}
                      className="mt-1 w-full rounded border border-bt-border-strong bg-bt-surface px-2 py-1.5 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
                    />
                  </div>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="depMode"
                    checked={departureMode === 'wish'}
                    onChange={() => setDepartureMode('wish')}
                    className="mt-1"
                  />
                  <span>일정 없이 희망 출발일만으로 접수 (가격·좌석은 확인 후 안내)</span>
                </label>
                {departureMode === 'wish' && (
                  <div className="pl-6">
                    <label htmlFor="booking-pref-only" className="text-xs text-bt-muted">
                      희망 출발일 <span className="text-bt-danger">*</span>
                    </label>
                    <input
                      id="booking-pref-only"
                      type="date"
                      required
                      value={preferredDateOnly}
                      onChange={(e) => setPreferredDateOnly(e.target.value)}
                      className="mt-1 w-full rounded border border-bt-border-strong bg-bt-surface px-2 py-1.5 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
                    />
                  </div>
                )}
              </div>
            )}

            {!hasPriceSchedule && (
              <div>
                <label htmlFor="booking-pref-no-schedule" className="mb-1 block text-xs font-medium text-bt-muted">
                  희망 출발일 <span className="text-bt-danger">*</span>
                </label>
                <input
                  id="booking-pref-no-schedule"
                  type="date"
                  required
                  value={preferredDateOnly}
                  onChange={(e) => setPreferredDateOnly(e.target.value)}
                  className="w-full rounded border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
                />
                <p className="mt-1 text-xs text-bt-meta">등록된 상품 일정이 없어 희망일만 접수합니다.</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="bin-name" className="mb-1 block text-xs font-medium text-bt-muted">
                  이름 <span className="text-bt-danger">*</span>
                </label>
                <input
                  id="bin-name"
                  name="customerName"
                  autoComplete="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
                  required
                />
              </div>
              <div>
                <label htmlFor="bin-phone" className="mb-1 block text-xs font-medium text-bt-muted">
                  휴대폰 <span className="text-bt-danger">*</span>
                </label>
                <input
                  id="bin-phone"
                  name="customerPhone"
                  type="tel"
                  autoComplete="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
                  required
                />
              </div>
              <div>
                <label htmlFor="bin-email" className="mb-1 block text-xs font-medium text-bt-muted">
                  이메일 <span className="text-bt-danger">*</span>
                </label>
                <input
                  id="bin-email"
                  name="customerEmail"
                  type="email"
                  autoComplete="email"
                  value={customerEmail}
                  onChange={(e) => {
                    const next = e.target.value
                    setCustomerEmail(next)
                    if (clientError === EMAIL_FORMAT_ERROR && hasValidEmailFormat(next)) {
                      setClientError('')
                    }
                  }}
                  onBlur={() => {
                    if (customerEmail.trim() && !hasValidEmailFormat(customerEmail)) {
                      setClientError(EMAIL_FORMAT_ERROR)
                    }
                  }}
                  className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
                  required
                />
              </div>
            </div>

            <div className="rounded border border-bt-border-soft bg-bt-surface-alt p-2 text-xs text-bt-muted">
              인원: 성인 {pax.adult} · 아동(베드) {pax.childBed} · 아동(노베드) {pax.childNoBed} · 유아 {pax.infant}{' '}
              <span className="text-bt-subtle">(상단 인원 선택과 동일하게 접수됩니다)</span>
              <p className="mt-1 text-[11px] text-bt-subtle">
                성인(만 12세 이상) · 아동(만 2세 이상~만 12세 미만) · 유아(만 2세 미만). 실제 적용은 상품/항공 규정에 따라 달라질 수 있습니다.
              </p>
            </div>

            {childCount + infantCount > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-bt-body">아동·유아 생년월일 (YYYY-MM-DD)</p>
                {Array.from({ length: childCount }).map((_, i) => (
                  <div key={`c-${i}`}>
                    <label className="text-xs text-bt-meta">아동 {i + 1}</label>
                    <input
                      type="date"
                      value={birthDates[i] ?? ''}
                      onChange={(e) => {
                        const next = [...birthDates]
                        next[i] = e.target.value
                        setBirthDates(next)
                      }}
                      className="mt-0.5 w-full rounded border border-bt-border-strong bg-bt-surface px-2 py-1.5 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
                      required
                    />
                  </div>
                ))}
                {Array.from({ length: infantCount }).map((_, j) => (
                  <div key={`i-${j}`}>
                    <label className="text-xs text-bt-meta">유아 {j + 1}</label>
                    <input
                      type="date"
                      value={birthDates[childCount + j] ?? ''}
                      onChange={(e) => {
                        const next = [...birthDates]
                        next[childCount + j] = e.target.value
                        setBirthDates(next)
                      }}
                      className="mt-0.5 w-full rounded border border-bt-border-strong bg-bt-surface px-2 py-1.5 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
                      required
                    />
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-bt-body">
              <input
                type="checkbox"
                checked={singleRoomRequested}
                onChange={(e) => setSingleRoomRequested(e.target.checked)}
              />
              1인실 사용 요청
            </label>

            <div>
              <p className="mb-1 text-xs font-medium text-bt-muted">선호 상담 채널</p>
              <div className="flex flex-wrap gap-3 text-sm text-bt-body">
                {(['phone', 'kakao', 'email'] as const).map((ch) => (
                  <label key={ch} className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="contactCh"
                      checked={preferredContactChannel === ch}
                      onChange={() => setPreferredContactChannel(ch)}
                    />
                    {ch === 'phone' ? '전화' : ch === 'kakao' ? '카카오' : '이메일'}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="bin-notes" className="mb-1 block text-xs font-medium text-bt-muted">
                요청사항 (선택)
              </label>
              <textarea
                id="bin-notes"
                name="requestNotes"
                rows={3}
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
                placeholder="문의·좌석·식사 등"
              />
            </div>

            {(clientError || serverError) && (
              <p className="whitespace-pre-wrap text-sm text-bt-danger">{clientError || serverError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-bt-cta-secondary-border bg-bt-cta-secondary py-2.5 text-sm font-medium text-bt-cta-secondary-text hover:bg-bt-surface-soft"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 border border-bt-cta-primary bg-bt-cta-primary py-2.5 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover disabled:opacity-50"
              >
                {submitting ? '접수 중…' : '요청 접수하기'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
