'use client'

import { useCallback, useId, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import BongtourDisclosureBlock from '@/components/bongtour/BongtourDisclosureBlock'
import {
  compactPayloadJson,
  inquiryKindToApiType,
  type InquiryKind,
  type InquiryPageQuery,
} from '@/lib/inquiry-page'
import { inquiryFormMeta, inquiryShellCopy } from '@/lib/inquiry-form-i18n'
import { buildInquiryThankYouHref } from '@/lib/inquiry-thank-you-path'
import ConsentBlock from '@/components/auth/ConsentBlock'
import type { FieldErrors } from '@/lib/customer-inquiry-intake'
import { formatKoreanTelInput } from '@/lib/korean-tel-format'
import { optionalEmailFormatError } from '@/lib/email-format'
import { readUtmFromSession } from '@/lib/utm-capture'

type ApiErrorJson = {
  ok?: boolean
  /** false면 DB·알림 없음(봇 차단·허니팟). ok만 true인 응답은 접수로 보지 않음 */
  persisted?: boolean
  error?: string
  fieldErrors?: FieldErrors
  inquiry?: { id: string }
  notification?: {
    ok: boolean
    delayed?: boolean
    channels?: { email?: { ok: boolean }; adminLms?: { ok: boolean; skipped?: boolean } }
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
  /** 접수 완료 URL `from` 쿼리 (우리견적 등) */
  thankYouFrom?: 'private' | null
}

export default function InquiryFormShell({
  kind,
  initialQuery,
  children,
  buildPayloadJson,
  overlayMeta,
  beforeSubmit,
  messageRequired = false,
  messageLabel,
  submitButtonLabel,
  applicantNameLabel,
  applicantEmailRequired = false,
  privacyConsentLabel,
  privacyNoticeTitle,
  privacyNoticeContent,
  privacyNoticeVersion = 'training-inquiry-v1',
  preferredContactChannel = null,
  thankYouFrom = null,
}: InquiryFormShellProps) {
  const router = useRouter()
  const lang = initialQuery.uiLang ?? 'ko'
  const copy = inquiryShellCopy(lang)
  const meta = overlayMeta ?? inquiryFormMeta(kind, lang)
  const resolvedNameLabel = applicantNameLabel ?? copy.name
  const resolvedMessageLabel = messageLabel ?? copy.message
  const resolvedSubmitLabel = submitButtonLabel ?? copy.submit
  const resolvedPrivacyConsent = privacyConsentLabel ?? copy.privacyConsent
  const resolvedPrivacyTitle = privacyNoticeTitle ?? copy.privacyTitle
  const apiType = inquiryKindToApiType(kind)

  const [applicantName, setApplicantName] = useState('')
  const [applicantPhone, setApplicantPhone] = useState('')
  const [applicantEmail, setApplicantEmail] = useState('')
  const [message, setMessage] = useState('')
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  /** 페이지(폼) 로드 시각 — 서버에서 최소 체류 시간 검증용 */
  const [formOpenedAt] = useState(() => Date.now())
  /** 허니팟 — `website_url` 이름은 브라우저 자동완성에 걸리기 쉬움 */
  const [hpTrap, setHpTrap] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

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
        btHpWebsite: '',
        btHpUrl: hpTrap.trim(),
        formOpenedAt,
        privacyAgreed: true,
        marketingConsent,
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
      // REGRESSION-FREEZE[inquiry-lang-en-bilingual]: 영문 블로그 유입 표시 — manifest
      if (lang === 'en') body.inquiryUiLang = 'en'
      Object.assign(body, readUtmFromSession())

      if (!privacyAgreed) {
        setFieldErrors({ privacyAgreed: copy.privacyRequired })
        setSubmitting(false)
        return
      }
      if (applicantEmailRequired && !applicantEmail.trim()) {
        setFieldErrors({ applicantEmail: copy.emailRequired })
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
        setFieldErrors({ message: copy.messageRequired(resolvedMessageLabel) })
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
        setFormError(typeof data.error === 'string' ? data.error : copy.fail)
        if (data.fieldErrors && typeof data.fieldErrors === 'object') {
          setFieldErrors(data.fieldErrors)
        }
        return
      }

      if (data.persisted === false) {
        setFormError(copy.notPersisted)
        return
      }

      const notify = data.notification
      const notifyFailed =
        notify &&
        (notify.ok === false ||
          notify.channels?.email?.ok === false ||
          (notify.channels?.adminLms && !notify.channels.adminLms.skipped && notify.channels.adminLms.ok === false))
      // REGRESSION-FREEZE[inquiry-thank-you-redirect]: 접수 성공 → thank-you URL — manifest
      router.replace(
        buildInquiryThankYouHref({
          kind,
          delayed: Boolean(notifyFailed),
          contact: preferredContactChannel,
          from: thankYouFrom,
          lang: lang === 'en' ? 'en' : null,
        }),
      )
    } catch {
      setFormError(copy.network)
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
    marketingConsent,
    preferredContactChannel,
    initialQuery,
    beforeSubmit,
    resolvedMessageLabel,
    messageRequired,
    privacyNoticeVersion,
    hpTrap,
    formOpenedAt,
    router,
    kind,
    thankYouFrom,
    lang,
    copy.privacyRequired,
    copy.emailRequired,
    copy.fail,
    copy.notPersisted,
    copy.network,
  ])

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <header className="mb-8 border-b border-slate-200/90 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/90">{copy.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{meta.title}</h1>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{meta.description}</p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">{copy.shortNotice}</p>
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
          name="btHpWebsite"
          value=""
          readOnly
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
        />
        <input
          type="text"
          name="btHpUrl"
          value={hpTrap}
          onChange={(e) => setHpTrap(e.target.value)}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
        />
        {initialQuery.productId ? (
          <input type="hidden" name="productId" value={initialQuery.productId} />
        ) : null}
        {initialQuery.monthlyCurationItemId ? (
          <input type="hidden" name="monthlyCurationItemId" value={initialQuery.monthlyCurationItemId} />
        ) : null}
        {initialQuery.snapshotProductTitle ? (
          <input type="hidden" name="snapshotProductTitle" value={initialQuery.snapshotProductTitle} />
        ) : null}
        {initialQuery.snapshotCardLabel ? (
          <input type="hidden" name="snapshotCardLabel" value={initialQuery.snapshotCardLabel} />
        ) : null}
        {initialQuery.snapshotOriginCode ? (
          <input type="hidden" name="snapshotOriginCode" value={initialQuery.snapshotOriginCode} />
        ) : null}
        {(initialQuery.snapshotProductTitle || initialQuery.snapshotCardLabel) && (
          <p className="rounded-lg border border-[#EFEDF8] bg-[#EFEDF8]/80 px-4 py-3 text-sm text-[#1F1B2D]">
            {initialQuery.snapshotProductTitle ? (
              <>
                {copy.productInquiry}: <span className="font-semibold">{initialQuery.snapshotProductTitle}</span>
              </>
            ) : (
              <span className="font-semibold">{copy.travelConsult}</span>
            )}
            {initialQuery.snapshotCardLabel ? (
              <span className="text-[#1F1B2D]/80"> · {initialQuery.snapshotCardLabel}</span>
            ) : null}
            {initialQuery.snapshotOriginCode ? (
              <span className="text-[#1F1B2D]/70"> · {initialQuery.snapshotOriginCode}</span>
            ) : null}
          </p>
        )}
        <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold text-slate-800">{copy.contactHeading}</h2>

          <div>
            <label htmlFor={ids.name} className="block text-sm font-medium text-slate-700">
              {resolvedNameLabel} <span className="text-rose-600">*</span>
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
              {copy.phone} <span className="text-rose-600">*</span>
            </label>
            <input
              id={ids.phone}
              name="applicantPhone"
              type="tel"
              autoComplete="tel"
              required
              value={applicantPhone}
              onChange={(e) =>
                setApplicantPhone(
                  lang === 'en' ? e.target.value.slice(0, 40) : formatKoreanTelInput(e.target.value),
                )
              }
              placeholder={lang === 'en' ? '+82 10-0000-0000 or +1 …' : undefined}
              aria-invalid={Boolean(fieldErrors.applicantPhone)}
              aria-describedby={fieldErrors.applicantPhone ? `${ids.phone}-err` : copy.phoneHint ? `${ids.phone}-hint` : undefined}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            {copy.phoneHint ? (
              <p id={`${ids.phone}-hint`} className="mt-1 text-xs text-slate-500">
                {copy.phoneHint}
              </p>
            ) : null}
            {fieldErrors.applicantPhone && (
              <p id={`${ids.phone}-err`} className="mt-1 text-xs text-rose-600" role="alert">
                {fieldErrors.applicantPhone}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={ids.email} className="block text-sm font-medium text-slate-700">
              {copy.email}{' '}
              {applicantEmailRequired ? (
                <span className="text-rose-600">*</span>
              ) : (
                <span className="text-slate-400">{copy.optional}</span>
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
              {resolvedMessageLabel}{' '}
              {messageRequired ? (
                <span className="text-rose-600">*</span>
              ) : (
                <span className="text-slate-400">{copy.optional}</span>
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
          <h2 className="text-sm font-semibold text-slate-800">{copy.extraHeading}</h2>
          {children}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setPrivacyOpen((v) => !v)}
            className="mb-3 inline-flex items-center text-xs font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            {copy.privacyToggle}
          </button>
          {privacyOpen && (
            <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
              <p className="font-semibold text-slate-900">{resolvedPrivacyTitle}</p>
              <div className="mt-2">{privacyNoticeContent ?? copy.privacyBodyFallback}</div>
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
                {resolvedPrivacyConsent} <span className="text-rose-600">*</span>
              </label>
              <p id={ids.privacyHint} className="mt-1 text-xs leading-relaxed text-slate-500">
                {copy.privacyHint}
              </p>
              {fieldErrors.privacyAgreed && (
                <p className="mt-1 text-xs text-rose-600" role="alert">
                  {fieldErrors.privacyAgreed}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 border-t border-slate-200 pt-3">
            <ConsentBlock
              type="marketing"
              checked={marketingConsent}
              onChange={setMarketingConsent}
              required={false}
              label={copy.marketing}
              openLabel={copy.marketingToggle}
            />
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
            {submitting ? copy.submitting : resolvedSubmitLabel}
          </button>
          <p className="text-center text-xs text-slate-500 sm:text-left">
            {copy.submitHint}
          </p>
        </div>
      </form>

      <div className="mt-10">
        {copy.disclosureEn ? (
          <p className="mb-3 text-sm leading-relaxed text-slate-600">{copy.disclosureEn}</p>
        ) : null}
        <BongtourDisclosureBlock showBrandMarkHelper />
      </div>
    </div>
  )
}
