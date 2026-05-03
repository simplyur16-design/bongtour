'use client'

import { useCallback, useId, useMemo, useState } from 'react'
import BongtourDisclosureBlock from '@/components/bongtour/BongtourDisclosureBlock'
import InquirySuccessPanel from '@/components/bongtour/InquirySuccessPanel'
import { SHORT_NOTICES } from '@/lib/bongtour-copy'
import {
  compactPayloadJson,
  inquiryKindToApiType,
  INQUIRY_UI_META,
  type InquiryKind,
  type InquiryPageQuery,
  type InquirySuccessKind,
} from '@/lib/inquiry-page'
import type { FieldErrors } from '@/lib/customer-inquiry-intake'
import { KAKAO_OPEN_CHAT_URL } from '@/lib/kakao-open-chat'
import { formatKoreanTelInput } from '@/lib/korean-tel-format'
import { optionalEmailFormatError } from '@/lib/email-format'

type ApiErrorJson = {
  ok?: boolean
  error?: string
  fieldErrors?: FieldErrors
  inquiry?: { id: string }
  notification?: {
    ok: boolean
    delayed?: boolean
    channels?: { email?: { ok: boolean } }
  }
}

export type InquiryFormShellProps = {
  kind: InquiryKind
  /** URL 쿼리에서 온 컨텍스트(상품·큐레이션·스냅샷·희망 월 프리필) */
  initialQuery: InquiryPageQuery
  /** 유형별 추가 필드 블록 */
  children: React.ReactNode
  /** `payloadJson`에 합쳐질 객체 (빈 값은 제출 전 compact로 제거) */
  buildPayloadJson: () => Record<string, unknown>
  /** 우리견적 등 동일 API 유형으로 제목만 바꿀 때 */
  overlayMeta?: { title: string; description: string } | null
  /** 추가 필드 블록 사전 검증 */
  beforeSubmit?: () => { fieldErrors?: FieldErrors; formError?: string } | null
  /** 문의 내용 필수 여부 */
  messageRequired?: boolean
  /** 문의 내용 라벨 커스텀 */
  messageLabel?: string
  /** 제출 버튼 라벨 커스텀 */
  submitButtonLabel?: string
  /** 신청자 이름 라벨 커스텀 */
  applicantNameLabel?: string
  /** 이메일 필수 여부 */
  applicantEmailRequired?: boolean
  privacyConsentLabel?: string
  privacyNoticeTitle?: string
  privacyNoticeContent?: React.ReactNode
  privacyNoticeVersion?: string
  preferredContactChannel?: 'email' | 'kakao' | 'both' | null
  successMessage?: string
  successHintMessage?: string | null
}

export default function InquiryFormShell({
  kind,
  initialQuery,
  children,
  buildPayloadJson,
  overlayMeta,
  beforeSubmit,
  messageRequired = false,
  messageLabel = '문의 내용',
  submitButtonLabel = '문의 접수하기',
  applicantNameLabel = '신청자 이름',
  applicantEmailRequired = false,
  privacyConsentLabel = '개인정보 수집·이용 안내를 확인했습니다',
  privacyNoticeTitle = '개인정보 수집·이용 안내',
  privacyNoticeContent,
  privacyNoticeVersion = 'training-inquiry-v1',
  preferredContactChannel = null,
  successMessage = '문의가 접수되었습니다. 확인 후 순차적으로 안내드리겠습니다.',
  successHintMessage = null,
}: InquiryFormShellProps) {
  const meta = overlayMeta ?? INQUIRY_UI_META[kind]
  const apiType = inquiryKindToApiType(kind)

  const [applicantName, setApplicantName] = useState('')
  const [applicantPhone, setApplicantPhone] = useState('')
  const [applicantEmail, setApplicantEmail] = useState('')
  const [message, setMessage] = useState('')
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  /** 페이지(폼) 로드 시각 — 서버에서 최소 체류 시간 검증용 */
  const [formOpenedAt] = useState(() => Date.now())
  const [websiteUrl, setWebsiteUrl] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [done, setDone] = useState(false)
  /** 접수 DB 성공 후 운영자 이메일 알림이 실패한 경우 */
  const [notificationDelayed, setNotificationDelayed] = useState(false)

  const baseId = useId()
  const ids = useMemo(
    () => ({
      name: `${baseId}-name`,
      phone: `${baseId}-phone`,
      email: `${baseId}-email`,
      message: `${baseId}-message`,
      privacy: `${baseId}-privacy`,
      privacyHint: `${baseId}-privacy-hint`,
    }),
    [baseId]
  )

  const extraFieldErrorMessages = useMemo(() => {
    const known = new Set([
      'applicantName',
      'applicantPhone',
      'applicantEmail',
      'message',
      'privacyAgreed',
    ])
    return Object.entries(fieldErrors)
      .filter(([k]) => !known.has(k))
      .map(([, v]) => v)
  }, [fieldErrors])

  const validateEmailFormat = (value: string): string | null => optionalEmailFormatError(value)

  const submit = useCallback(async () => {
    setFormError(null)
    setFieldErrors({})
    setNotificationDelayed(false)
    setSubmitting(true)
    try {
      const q = initialQuery
      const path =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`.slice(0, 2000)
          : null

      const extra = compactPayloadJson(buildPayloadJson())
      const body: Record<string, unknown> = {
        inquiryType: apiType,
        applicantName: applicantName.trim(),
        applicantPhone: applicantPhone.trim(),
        website: '',
        website_url: websiteUrl.trim(),
        formOpenedAt,
        privacyAgreed: true,
        privacyNoticeConfirmedAt: new Date().toISOString(),
        privacyNoticeVersion,
      }
      if (applicantEmail.trim()) body.applicantEmail = applicantEmail.trim()
      if (message.trim()) body.message = message.trim()
      if (q?.productId) body.productId = q.productId
      if (q?.monthlyCurationItemId) body.monthlyCurationItemId = q.monthlyCurationItemId
      if (q?.snapshotProductTitle) body.snapshotProductTitle = q.snapshotProductTitle
      if (q?.snapshotCardLabel) body.snapshotCardLabel = q.snapshotCardLabel
      if (path) body.sourcePagePath = path
      if (Object.keys(extra).length > 0) body.payloadJson = extra
      if (preferredContactChannel) body.preferredContactChannel = preferredContactChannel

      if (!privacyAgreed) {
        setFieldErrors({ privacyAgreed: '개인정보 처리에 동의해 주세요.' })
        setSubmitting(false)
        return
      }
      if (applicantEmailRequired && !applicantEmail.trim()) {
        setFieldErrors({ applicantEmail: '이메일을 입력해 주세요.' })
        setSubmitting(false)
        return
      }
      const emailFormatErr = validateEmailFormat(applicantEmail)
      if (emailFormatErr) {
        setFieldErrors({ applicantEmail: emailFormatErr })
        setSubmitting(false)
        return
      }
      if (messageRequired && !message.trim()) {
        setFieldErrors({ message: `${messageLabel}을(를) 입력해 주세요.` })
        setSubmitting(false)
        return
      }
      if (beforeSubmit) {
        const pre = beforeSubmit()
        if (pre?.fieldErrors && Object.keys(pre.fieldErrors).length > 0) {
          setFieldErrors(pre.fieldErrors)
          if (pre.formError) setFormError(pre.formError)
          setSubmitting(false)
          return
        }
      }

      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as ApiErrorJson

      if (!res.ok || data.ok === false) {
        setFormError(typeof data.error === 'string' ? data.error : '문의 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        if (data.fieldErrors && typeof data.fieldErrors === 'object') {
          setFieldErrors(data.fieldErrors)
        }
        return
      }

      setNotificationDelayed(Boolean(data.notification && data.notification.ok === false))
      setDone(true)
    } catch {
      setFormError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }, [
    applicantEmail,
    applicantName,
    applicantPhone,
    apiType,
    buildPayloadJson,
    message,
    privacyAgreed,
    preferredContactChannel,
    initialQuery,
    beforeSubmit,
    messageLabel,
    messageRequired,
    privacyNoticeVersion,
    websiteUrl,
    formOpenedAt,
  ])

  if (done) {
    const showOpenKakaoCta =
      preferredContactChannel === 'kakao' || preferredContactChannel === 'both'
    const kakaoGuide =
      preferredContactChannel === 'kakao'
        ? '문의가 접수되었습니다. 카카오톡 상담을 원하신 경우 아래 버튼을 통해 오픈카카오톡으로도 바로 상담을 이어가실 수 있습니다.'
        : '문의가 접수되었습니다. 선택하신 답변 방법을 기준으로 순차적으로 안내드리겠습니다. 카카오톡 상담을 원하시면 아래 오픈카카오톡을 통해 추가로 상담을 이어가실 수 있습니다.'
    return (
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <InquirySuccessPanel type={kind as InquirySuccessKind} />
        {notificationDelayed ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center">
            <p className="text-sm font-medium text-slate-900">문의는 정상 접수되었습니다.</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-700">알림 전송이 지연될 수 있습니다.</p>
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-slate-700">{successMessage}</p>
        )}
        {successHintMessage ? <p className="mt-2 text-center text-xs text-slate-600">{successHintMessage}</p> : null}
        {showOpenKakaoCta ? (
          <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-center">
            <p className="text-xs leading-relaxed text-slate-700">{kakaoGuide}</p>
            <a
              href={KAKAO_OPEN_CHAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center justify-center rounded-lg border border-yellow-300 bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-yellow-300"
            >
              오픈카카오톡 상담하기
            </a>
          </div>
        ) : null}
        <p className="mt-6 text-center text-xs text-slate-500">{SHORT_NOTICES.inquiryForm}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <header className="mb-8 border-b border-slate-200/90 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/90">문의 접수</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{meta.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{meta.description}</p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">{SHORT_NOTICES.inquiryForm}</p>
      </header>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        noValidate
      >
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
        <input
          type="text"
          name="website_url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
        />
        <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold text-slate-800">연락처·문의 내용</h2>

          <div>
            <label htmlFor={ids.name} className="block text-sm font-medium text-slate-700">
              {applicantNameLabel} <span className="text-rose-600">*</span>
            </label>
            <input
              id={ids.name}
              name="applicantName"
              type="text"
              autoComplete="name"
              required
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.applicantName)}
              aria-describedby={fieldErrors.applicantName ? `${ids.name}-err` : undefined}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            {fieldErrors.applicantName && (
              <p id={`${ids.name}-err`} className="mt-1 text-xs text-rose-600" role="alert">
                {fieldErrors.applicantName}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={ids.phone} className="block text-sm font-medium text-slate-700">
              연락처 <span className="text-rose-600">*</span>
            </label>
            <input
              id={ids.phone}
              name="applicantPhone"
              type="tel"
              autoComplete="tel"
              required
              value={applicantPhone}
              onChange={(e) => setApplicantPhone(formatKoreanTelInput(e.target.value))}
              aria-invalid={Boolean(fieldErrors.applicantPhone)}
              aria-describedby={fieldErrors.applicantPhone ? `${ids.phone}-err` : undefined}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            {fieldErrors.applicantPhone && (
              <p id={`${ids.phone}-err`} className="mt-1 text-xs text-rose-600" role="alert">
                {fieldErrors.applicantPhone}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={ids.email} className="block text-sm font-medium text-slate-700">
              이메일{' '}
              {applicantEmailRequired ? (
                <span className="text-rose-600">*</span>
              ) : (
                <span className="text-slate-400">(선택)</span>
              )}
            </label>
            <input
              id={ids.email}
              name="applicantEmail"
              type="email"
              autoComplete="email"
              required={applicantEmailRequired}
              value={applicantEmail}
              onChange={(e) => {
                const next = e.target.value
                setApplicantEmail(next)
                if (fieldErrors.applicantEmail) {
                  const err = validateEmailFormat(next)
                  if (!err) {
                    setFieldErrors((prev) => {
                      const { applicantEmail: _omit, ...rest } = prev
                      return rest
                    })
                  }
                }
              }}
              onBlur={() => {
                const err = validateEmailFormat(applicantEmail)
                if (err) {
                  setFieldErrors((prev) => ({ ...prev, applicantEmail: err }))
                }
              }}
              aria-invalid={Boolean(fieldErrors.applicantEmail)}
              aria-describedby={fieldErrors.applicantEmail ? `${ids.email}-err` : undefined}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            {fieldErrors.applicantEmail && (
              <p id={`${ids.email}-err`} className="mt-1 text-xs text-rose-600" role="alert">
                {fieldErrors.applicantEmail}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={ids.message} className="block text-sm font-medium text-slate-700">
              {messageLabel}{' '}
              {messageRequired ? (
                <span className="text-rose-600">*</span>
              ) : (
                <span className="text-slate-400">(선택)</span>
              )}
            </label>
            <textarea
              id={ids.message}
              name="message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-invalid={Boolean(fieldErrors.message)}
              aria-describedby={fieldErrors.message ? `${ids.message}-err` : undefined}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            {fieldErrors.message && (
              <p id={`${ids.message}-err`} className="mt-1 text-xs text-rose-600" role="alert">
                {fieldErrors.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200/90 bg-slate-50/80 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-800">추가 정보 (선택)</h2>
          {children}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setPrivacyOpen((v) => !v)}
            className="mb-3 inline-flex items-center text-xs font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            개인정보 수집·이용 안내 보기
          </button>
          {privacyOpen && (
            <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
              <p className="font-semibold text-slate-900">{privacyNoticeTitle}</p>
              <div className="mt-2">{privacyNoticeContent ?? '개인정보 수집·이용 안내를 확인해 주세요.'}</div>
            </div>
          )}
          <div className="flex gap-3">
            <input
              id={ids.privacy}
              name="privacyAgreed"
              type="checkbox"
              checked={privacyAgreed}
              onChange={(e) => setPrivacyAgreed(e.target.checked)}
              aria-invalid={Boolean(fieldErrors.privacyAgreed)}
              aria-describedby={ids.privacyHint}
              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            <div>
              <label htmlFor={ids.privacy} className="text-sm font-medium text-slate-800">
                {privacyConsentLabel} <span className="text-rose-600">*</span>
              </label>
              <p id={ids.privacyHint} className="mt-1 text-xs leading-relaxed text-slate-500">
                안내문 확인 후 체크해 주세요. 확인이 없으면 접수가 어렵습니다.
              </p>
              {fieldErrors.privacyAgreed && (
                <p className="mt-1 text-xs text-rose-600" role="alert">
                  {fieldErrors.privacyAgreed}
                </p>
              )}
            </div>
          </div>
        </div>

        {formError && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {formError}
          </p>
        )}
        {extraFieldErrorMessages.length > 0 && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
            {extraFieldErrorMessages.map((msg, idx) => (
              <p key={`${idx}-${msg}`}>{msg}</p>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {submitting ? '접수 중…' : submitButtonLabel}
          </button>
          <p className="text-center text-xs text-slate-500 sm:text-left">
            버튼은 &quot;접수&quot;이며, 확정 안내 전까지 예약·계약이 성립한 것은 아닙니다.
          </p>
        </div>
      </form>

      <div className="mt-10">
        <BongtourDisclosureBlock showBrandMarkHelper />
      </div>
    </div>
  )
}
