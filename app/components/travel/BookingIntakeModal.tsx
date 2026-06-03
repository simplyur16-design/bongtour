'use client'

import { useEffect, useId, useState } from 'react'
import {
  BOOKING_CUSTOMER_NAME_EN_REGEX,
  validateBookingIntake,
} from '@/lib/booking-intake-contract'
import {
  BOOKING_PRIVACY_CONSENT_LABEL,
  BOOKING_PRIVACY_NOTICE_BODY,
  BOOKING_PRIVACY_NOTICE_TITLE,
  BOOKING_PRIVACY_NOTICE_VERSION,
} from '@/lib/booking-consent'
import ConsentBlock from '@/components/auth/ConsentBlock'
import KakaoCounselCta from '@/app/components/travel/KakaoCounselCta'
import type { DeparturePriceCollectUiPhase } from '@/lib/departure-price-collect-ui'
import { departurePriceCollectUiCopy } from '@/lib/departure-price-collect-ui'
import { formatKoreanTelInput } from '@/lib/korean-tel-format'
import { optionalEmailFormatError } from '@/lib/email-format'
import { readUtmFromSession } from '@/lib/utm-capture'
import { parseBirthDateDigitsToYmd } from '@/lib/booking-birth-date-input'
import { BookingBirthDateField, BookingBirthDateFieldCompact } from '@/app/components/travel/BookingBirthDateField'

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
  /** 상세에서 고른 출발 가격 행 id (있으면 접수·카카오 요약에 포함) */
  departureRowId?: string | null
  /** 선택일 기준 운영 라벨(예약가능/상담필요/수집중 등) — 참고 표시만 */
  departureAdvisoryLabel?: string | null
  pax: BookingPax
  /** DB/병합 일정 행 존재 여부 — UI 분기용. 접수 차단에는 쓰지 않음 */
  hasPriceSchedule: boolean
  /** 전후 2주 on-demand 수집 중 — 상담 요약 참고 블록용 */
  isCollectingPrices?: boolean
  /** 수집·지연·pending_quote — 모달 상단 안내(접수 차단 없음) */
  priceCollectUiPhase?: DeparturePriceCollectUiPhase
}

type ApiSuccess = {
  ok: true
  bookingId: number
  bookingNumber?: string
  message: string
  pricingMode?: 'schedule_price' | 'schedule_selected_pending_quote'
}

export default function BookingIntakeModal({
  open,
  onClose,
  productId,
  productTitle,
  originSource,
  originCode,
  selectedDateFromCalendar,
  departureRowId = null,
  departureAdvisoryLabel = null,
  pax,
  hasPriceSchedule,
  isCollectingPrices = false,
  priceCollectUiPhase = 'idle',
}: Props) {
  const childCount = pax.childBed + pax.childNoBed
  const infantCount = pax.infant

  const [customerNameKo, setCustomerNameKo] = useState('')
  const [customerNameEn, setCustomerNameEn] = useState('')
  const [customerBirthDateDigits, setCustomerBirthDateDigits] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [singleRoomRequested, setSingleRoomRequested] = useState(false)
  const [preferredContactChannel, setPreferredContactChannel] = useState<'phone' | 'kakao' | 'email'>('phone')
  const [requestNotes, setRequestNotes] = useState('')

  const [birthDates, setBirthDates] = useState<string[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [clientError, setClientError] = useState('')
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState<ApiSuccess | null>(null)
  /** 접수 직전 폼의 상담 메모 — 제출 후 필드 초기화해도 CTA 요약에 유지 */
  const [successMemoSnapshot, setSuccessMemoSnapshot] = useState<string | null>(null)

  const baseId = useId()
  const privacyCheckboxId = `${baseId}-privacy`

  useEffect(() => {
    if (!open) return
    setClientError('')
    setServerError('')
    setSuccess(null)
    setSuccessMemoSnapshot(null)
  }, [open])

  useEffect(() => {
    const n = childCount + infantCount
    setBirthDates((prev) => {
      const next = [...prev]
      while (next.length < n) next.push('')
      return next.slice(0, n)
    })
  }, [childCount, infantCount])

  const selectedDepartureDate = selectedDateFromCalendar

  const buildPayload = () => {
    const rows: { type: 'child' | 'infant'; birthDate: string }[] = []
    for (let i = 0; i < childCount; i++) {
      rows.push({ type: 'child', birthDate: birthDates[i]?.trim() ?? '' })
    }
    for (let j = 0; j < infantCount; j++) {
      rows.push({ type: 'infant', birthDate: birthDates[childCount + j]?.trim() ?? '' })
    }
    const adultBirth = parseBirthDateDigitsToYmd(customerBirthDateDigits)
    const adultYmd = adultBirth.ok ? adultBirth.ymd : ''
    const childInfantBirthDates = rows.map((row, idx) => {
      const parsed = parseBirthDateDigitsToYmd(birthDates[idx] ?? '')
      return { type: row.type, birthDate: parsed.ok ? parsed.ymd : row.birthDate }
    })
    return {
      productId: String(productId),
      originSource,
      originCode,
      departureId: departureRowId?.trim() || null,
      selectedDepartureDate: selectedDepartureDate ?? '',
      customerName: customerNameKo.trim(),
      customerNameKo: customerNameKo.trim(),
      customerNameEn: customerNameEn.trim(),
      customerBirthDate: adultYmd,
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim(),
      privacyAgreed,
      privacyNoticeVersion: BOOKING_PRIVACY_NOTICE_VERSION,
      marketingConsent,
      adultCount: pax.adult,
      childCount,
      childWithBedCount: pax.childBed,
      childNoBedCount: pax.childNoBed,
      infantCount,
      singleRoomRequested,
      preferredContactChannel,
      childInfantBirthDates,
      requestNotes: requestNotes.trim() || null,
    }
  }

  const runClientChecks = (): string | null => {
    if (!customerNameKo.trim()) return '한글 이름을 입력해 주세요.'
    if (!customerNameEn.trim()) return '영문 이름을 입력해 주세요.'
    if (!BOOKING_CUSTOMER_NAME_EN_REGEX.test(customerNameEn.trim())) {
      return '영문 이름은 영문·공백만 입력할 수 있습니다.'
    }
    const adultBirthCheck = parseBirthDateDigitsToYmd(customerBirthDateDigits)
    if (!adultBirthCheck.ok) return adultBirthCheck.message
    if (!customerEmail.trim()) return '이메일을 입력해 주세요.'
    if (!privacyAgreed) return '개인정보 수집·이용에 동의해 주세요.'
    if (!selectedDateFromCalendar) {
      return '상단에서 출발일을 선택해 주세요. 원하는 날짜가 없으면 카카오 상담으로 문의해 주세요.'
    }
    const emErr = optionalEmailFormatError(customerEmail)
    if (emErr) return emErr
    for (let i = 0; i < childCount + infantCount; i++) {
      const parsed = parseBirthDateDigitsToYmd(birthDates[i] ?? '')
      if (!parsed.ok) return parsed.message
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
        customerNameKo: validated.value.customerNameKo,
        customerNameEn: validated.value.customerNameEn,
        customerBirthDate: validated.value.customerBirthDate,
        customerPhone: validated.value.customerPhone,
        customerEmail: validated.value.customerEmail,
        privacyAgreed: validated.value.privacyAgreed,
        privacyNoticeVersion: validated.value.privacyNoticeVersion,
        marketingConsent: validated.value.marketingConsent,
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
      body.selectedDate = validated.value.selectedDepartureDate
      body.selectedDepartureDate = validated.value.selectedDepartureDate
      if (validated.value.departureId) {
        body.departureId = validated.value.departureId
        body.sourceRowId = validated.value.departureId
      }
      Object.assign(body, readUtmFromSession())

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
        const memoSnap = requestNotes.trim() || null
        setSuccess({
          ok: true,
          bookingId: data.bookingId ?? 0,
          bookingNumber: typeof data.bookingNumber === 'string' ? data.bookingNumber : undefined,
          message: data.message,
          pricingMode: data.pricingMode,
        })
        setSuccessMemoSnapshot(memoSnap)
        setCustomerNameKo('')
        setCustomerNameEn('')
        setCustomerBirthDateDigits('')
        setCustomerPhone('')
        setCustomerEmail('')
        setPrivacyAgreed(false)
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
            <h3 className="text-lg font-semibold tracking-tight text-bt-title">예약 신청</h3>
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
              {(success.pricingMode === 'schedule_price' ||
                success.pricingMode === 'schedule_selected_pending_quote') && (
                <p className="mt-2 text-xs text-bt-meta">
                  안내된 견적은 참고용이며, 최종 조건은 담당자 확인 후 확정됩니다.
                </p>
              )}
              {success.pricingMode === 'schedule_selected_pending_quote' && (
                <p className="mt-3 rounded border border-bt-border-soft bg-bt-surface-alt px-3 py-2 text-sm text-bt-body">
                  선택하신 출발일은 접수되었으나, 해당 일자 요금 행이 아직 없어 견적 금액은 0으로 저장됩니다. 담당자가 확인 후 연락드립니다.
                </p>
              )}
              <p className="mt-3 text-xs text-bt-meta">
                예약 확정이 아닙니다. 순차적으로 연락드리니 양해 부탁드립니다.
              </p>
            </div>
            <div className="rounded-lg border border-dashed border-bt-border-soft bg-bt-surface p-3">
              <p className="text-xs font-medium text-bt-body">추가 문의</p>
              <p className="mt-1 text-[11px] leading-relaxed text-bt-meta">
                접수와 별도로 상품·일정을 바로 물어보시려면 카카오 오픈채팅으로 연결할 수 있습니다. 요약 형식은 동일합니다.
              </p>
              <div className="mt-2 space-y-2">
                <KakaoCounselCta
                  variant="kakaoSoft"
                  showHelper
                  intent="booking"
                  fromScreen="booking_success_modal"
                  productId={productId}
                  listingProductNumber={originCode}
                  productTitle={productTitle}
                  originSource={originSource}
                  originCode={originCode}
                  selectedDepartureDate={selectedDateFromCalendar}
                  selectedDepartureId={departureRowId}
                  pax={pax}
                  bookingId={success.bookingId}
                  customerMemo={successMemoSnapshot}
                  advisoryLabel={departureAdvisoryLabel}
                  pricingMode={success.pricingMode ?? null}
                  isCollectingPrices={isCollectingPrices}
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
            {(priceCollectUiPhase === 'collecting' || priceCollectUiPhase === 'delayed_collecting') && (
              <div
                className={`rounded-lg border px-3 py-2.5 text-sm leading-relaxed ${
                  priceCollectUiPhase === 'delayed_collecting'
                    ? 'border-amber-200 bg-amber-50/90 text-amber-950'
                    : 'border-bt-border-soft bg-bt-surface-alt text-bt-body'
                }`}
                role="status"
                aria-live="polite"
              >
                <p>
                  {priceCollectUiPhase === 'delayed_collecting'
                    ? departurePriceCollectUiCopy.modalBannerDelayed
                    : departurePriceCollectUiCopy.modalBannerCollecting}
                </p>
              </div>
            )}
            {priceCollectUiPhase === 'pending_quote' && !isCollectingPrices ? (
              <div
                className="rounded-lg border border-bt-border-soft bg-bt-surface-alt px-3 py-2.5 text-sm leading-relaxed text-bt-body"
                role="status"
              >
                {departurePriceCollectUiCopy.cardPendingQuoteHint}
              </div>
            ) : null}
            {selectedDateFromCalendar ? (
              <div className="rounded-lg border border-bt-border-soft bg-bt-surface-alt p-3">
                <p className="text-xs font-medium text-bt-muted">선택 출발일 (상세와 동일)</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-bt-title">{selectedDateFromCalendar}</p>
                {departureAdvisoryLabel ? (
                  <p className="mt-1 text-xs text-bt-meta">
                    일정 상태(참고): <span className="font-semibold text-bt-body">{departureAdvisoryLabel}</span>
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] leading-relaxed text-bt-subtle">
                  예약 가능 표시와 관계없이 요청 접수가 가능합니다. 실제 좌석·조건은 상담으로 확정됩니다.
                </p>
              </div>
            ) : null}
            {!selectedDateFromCalendar && (
              <div className="rounded-lg border border-bt-border-soft bg-bt-surface-alt p-3">
                <p className="text-sm leading-relaxed text-bt-body">
                  원하는 출발일이 캘린더에 없으면, 상단 일정에서 날짜를 선택하거나 카카오 상담으로 문의해 주세요.
                </p>
                <div className="mt-3">
                  <KakaoCounselCta
                    variant="kakaoSoft"
                    showHelper
                    intent="booking"
                    fromScreen="product_detail_desktop"
                    productId={productId}
                    listingProductNumber={originCode}
                    productTitle={productTitle}
                    originSource={originSource}
                    originCode={originCode}
                    selectedDepartureDate={null}
                    selectedDepartureId={departureRowId}
                    pax={pax}
                    customerMemo={requestNotes.trim() || null}
                    advisoryLabel={departureAdvisoryLabel}
                    pricingMode={null}
                    isCollectingPrices={isCollectingPrices}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="bin-name-ko" className="mb-1 block text-xs font-medium text-bt-muted">
                  한글 이름 <span className="text-bt-danger">*</span>
                </label>
                <input
                  id="bin-name-ko"
                  name="customerNameKo"
                  autoComplete="name"
                  value={customerNameKo}
                  onChange={(e) => setCustomerNameKo(e.target.value)}
                  className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
                  required
                />
              </div>
              <div>
                <label htmlFor="bin-name-en" className="mb-1 block text-xs font-medium text-bt-muted">
                  영문 이름 <span className="text-bt-danger">*</span>
                </label>
                <input
                  id="bin-name-en"
                  name="customerNameEn"
                  autoComplete="off"
                  value={customerNameEn}
                  onChange={(e) => setCustomerNameEn(e.target.value)}
                  placeholder="HONG GILDONG"
                  className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
                  required
                />
                <p className="mt-1 text-[11px] text-bt-subtle">여권 표기와 동일하게 영문·공백만 입력해 주세요.</p>
              </div>
              <BookingBirthDateField
                id="bin-birth"
                className="sm:col-span-2"
                digits={customerBirthDateDigits}
                onDigitsChange={setCustomerBirthDateDigits}
                label={
                  <label htmlFor="bin-birth" className="mb-1 block text-sm font-medium text-bt-muted">
                    생년월일 (성인 대표) <span className="text-bt-danger">*</span>
                  </label>
                }
              />
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
                  onChange={(e) => setCustomerPhone(formatKoreanTelInput(e.target.value))}
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
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  onBlur={() => {
                    const err = optionalEmailFormatError(customerEmail)
                    if (err) setClientError(err)
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
                <p className="text-sm font-medium text-bt-body">아동·유아 생년월일</p>
                <p className="text-[11px] text-bt-subtle">숫자 8자리 (예: 20150315)</p>
                {Array.from({ length: childCount }).map((_, i) => (
                  <BookingBirthDateFieldCompact
                    key={`c-${i}`}
                    id={`booking-child-birth-${i}`}
                    digits={birthDates[i] ?? ''}
                    onDigitsChange={(digits) => {
                      const next = [...birthDates]
                      next[i] = digits
                      setBirthDates(next)
                    }}
                    label={<label className="text-sm text-bt-meta">아동 {i + 1}</label>}
                  />
                ))}
                {Array.from({ length: infantCount }).map((_, j) => (
                  <BookingBirthDateFieldCompact
                    key={`i-${j}`}
                    id={`booking-infant-birth-${j}`}
                    digits={birthDates[childCount + j] ?? ''}
                    onDigitsChange={(digits) => {
                      const next = [...birthDates]
                      next[childCount + j] = digits
                      setBirthDates(next)
                    }}
                    label={<label className="text-sm text-bt-meta">유아 {j + 1}</label>}
                  />
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

            <div className="rounded-lg border border-bt-border-soft bg-bt-surface px-4 py-3">
              <button
                type="button"
                onClick={() => setPrivacyOpen((v) => !v)}
                className="mb-3 inline-flex items-center text-xs font-medium text-bt-body underline decoration-bt-border-strong underline-offset-2 hover:text-bt-title"
              >
                개인정보 수집·이용 안내 보기
              </button>
              {privacyOpen ? (
                <div className="mb-3 rounded-md border border-bt-border-soft bg-bt-surface-alt p-3 text-xs leading-relaxed text-bt-body whitespace-pre-wrap">
                  <p className="font-semibold text-bt-title">{BOOKING_PRIVACY_NOTICE_TITLE}</p>
                  <p className="mt-2">{BOOKING_PRIVACY_NOTICE_BODY}</p>
                </div>
              ) : null}
              <div className="flex gap-3">
                <input
                  id={privacyCheckboxId}
                  name="privacyAgreed"
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-bt-border-strong text-bt-brand-blue-strong focus:ring-bt-brand-blue-soft"
                />
                <div>
                  <label htmlFor={privacyCheckboxId} className="text-sm font-medium text-bt-body">
                    {BOOKING_PRIVACY_CONSENT_LABEL} <span className="text-bt-danger">*</span>
                  </label>
                  <p className="mt-1 text-xs leading-relaxed text-bt-subtle">
                    안내문 확인 후 체크해 주세요. 동의하지 않으면 예약 신청이 어렵습니다.
                  </p>
                </div>
              </div>
              <div className="mt-3 border-t border-bt-border-soft pt-3">
                <ConsentBlock
                  type="marketing"
                  checked={marketingConsent}
                  onChange={setMarketingConsent}
                  required={false}
                />
              </div>
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
                disabled={submitting || !privacyAgreed || !selectedDateFromCalendar}
                className="flex-1 border border-bt-cta-primary bg-bt-cta-primary py-2.5 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover disabled:opacity-50"
              >
                {submitting ? '접수 중…' : '예약 신청'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
