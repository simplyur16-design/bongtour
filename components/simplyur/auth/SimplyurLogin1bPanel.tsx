'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SimplyurEmailSignInForm } from '@/components/simplyur/auth/SimplyurEmailSignInForm'
import { SimplyurSignalPinIcon } from '@/components/simplyur/auth/SimplyurSignalPinIcon'
import { SIMPLYUR_LOGIN_1B } from '@/lib/simplyur/login-design'
import { simplyurPath, type SimplyurLocale } from '@/lib/simplyur/constants'

type Props = {
  locale: SimplyurLocale
  callbackUrl: string
  labels: {
    welcomeTitle: string
    welcomeSubtitle: string
    skip: string
    continueEmail: string
    emailSubtitle: string
    email: string
    invalidCredentials: string
    appSocialHint: string
    domesticEsimLink: string
    domesticSignInLink: string
    backToMethods: string
    backHome: string
    signInSubmit: string
    noAccount: string
    signUpLink: string
    forgotPasswordLink: string
  }
  domesticEsimHref: string
  domesticSignInHref: string
  signUpHref: string
  forgotPasswordHref: string
}

/**
 * design_handoff_login_1b — simplyur 웹 변형.
 * 앱과 동일한 centered 레이아웃; 웹은 이메일만(Apple·Google은 앱 전용).
 */
export function SimplyurLogin1bPanel({
  locale,
  callbackUrl,
  labels,
  domesticEsimHref,
  domesticSignInHref,
  signUpHref,
  forgotPasswordHref,
}: Props) {
  const [showEmail, setShowEmail] = useState(false)

  return (
    <div
      className="relative flex min-h-[70vh] flex-col px-7 pb-10 pt-6"
      style={{ backgroundColor: SIMPLYUR_LOGIN_1B.bg }}
    >
      <Link
        href={simplyurPath(locale)}
        className="absolute right-7 top-16 text-[13px] font-normal no-underline"
        style={{ color: SIMPLYUR_LOGIN_1B.faint }}
      >
        {labels.skip}
      </Link>

      <div className="flex flex-1 flex-col justify-center">
        {!showEmail ? (
          <>
            <div className="mb-10 flex flex-col items-center gap-[18px]">
              <SimplyurSignalPinIcon />
              <div className="flex flex-col items-center gap-1.5 text-center">
                <h1
                  className="text-2xl font-semibold tracking-tight"
                  style={{ color: SIMPLYUR_LOGIN_1B.navy }}
                >
                  {labels.welcomeTitle}
                </h1>
                <p className="text-[13px] leading-relaxed" style={{ color: SIMPLYUR_LOGIN_1B.muted }}>
                  {labels.welcomeSubtitle}
                </p>
              </div>
            </div>

            <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
              <button
                type="button"
                onClick={() => setShowEmail(true)}
                className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl border-0 text-base font-semibold text-white shadow-[0_12px_26px_-12px_rgba(255,107,74,0.55)]"
                style={{ backgroundColor: SIMPLYUR_LOGIN_1B.coral }}
              >
                <EmailEnvelopeIcon />
                {labels.continueEmail}
              </button>
            </div>

            <p
              className="mx-auto mt-8 max-w-sm text-center text-[11px] leading-relaxed"
              style={{ color: SIMPLYUR_LOGIN_1B.muted }}
            >
              {labels.appSocialHint}
            </p>

            <div
              className="mx-auto mt-4 max-w-sm space-y-2 text-center text-[11px] leading-relaxed"
              style={{ color: SIMPLYUR_LOGIN_1B.muted }}
            >
              <p>
                <Link href={domesticEsimHref} className="font-medium hover:underline" style={{ color: SIMPLYUR_LOGIN_1B.coral }}>
                  {labels.domesticEsimLink}
                </Link>
              </p>
              <p>
                <Link href={domesticSignInHref} className="font-medium hover:underline" style={{ color: SIMPLYUR_LOGIN_1B.coral }}>
                  {labels.domesticSignInLink}
                </Link>
              </p>
            </div>
          </>
        ) : (
          <div className="mx-auto w-full max-w-sm">
            <button
              type="button"
              onClick={() => setShowEmail(false)}
              className="mb-6 text-sm"
              style={{ color: SIMPLYUR_LOGIN_1B.faint }}
            >
              ← {labels.backToMethods}
            </button>
            <div className="mb-8 flex flex-col items-center gap-3.5 text-center">
              <SimplyurSignalPinIcon width={36} height={43} />
              <p className="text-[15px] leading-relaxed" style={{ color: SIMPLYUR_LOGIN_1B.muted }}>
                {labels.emailSubtitle}
              </p>
            </div>
            <SimplyurEmailSignInForm
              callbackUrl={callbackUrl}
              submitLabel={labels.signInSubmit}
              invalidCredentialsLabel={labels.invalidCredentials}
              variant="login1b"
              forgotPasswordHref={forgotPasswordHref}
              forgotPasswordLabel={labels.forgotPasswordLink}
            />
            <p
              className="mt-4 text-center text-[12px] leading-relaxed"
              style={{ color: SIMPLYUR_LOGIN_1B.muted }}
            >
              {labels.noAccount}{' '}
              <Link
                href={signUpHref}
                className="font-medium underline"
                style={{ color: SIMPLYUR_LOGIN_1B.coral }}
              >
                {labels.signUpLink}
              </Link>
            </p>
          </div>
        )}
      </div>

      <Link
        href={simplyurPath(locale)}
        className="mt-8 text-center text-sm font-medium hover:underline"
        style={{ color: SIMPLYUR_LOGIN_1B.coral }}
      >
        {labels.backHome}
      </Link>
    </div>
  )
}

function EmailEnvelopeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6.5C3 5.67 3.67 5 4.5 5h15c.83 0 1.5.67 1.5 1.5v11c0 .83-.67 1.5-1.5 1.5h-15C3.67 18 3 17.33 3 16.5v-10Z"
        stroke="#fff"
        strokeWidth="1.6"
      />
      <path
        d="M4 6.5l8 6 8-6"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
