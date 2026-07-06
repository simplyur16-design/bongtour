'use client'

import Link from 'next/link'
import type { SignInSocialMethod } from '@/lib/auth/sign-in-method-catalog'
import {
  SIGN_IN_METHOD_DEFINITIONS,
  buildSignInMethodHref,
  type SignInMethod,
} from '@/lib/auth/sign-in-method-catalog'

type SocialOption = {
  id: SignInSocialMethod
  enabled: boolean
}

type Props = {
  callbackUrl: string
  csrfToken: string
  socialOptions: SocialOption[]
  emailEnabled: boolean
}

const SOCIAL_BUTTON_BASE =
  'group relative flex h-12 w-full items-center justify-center gap-3 rounded-xl px-4 text-[15px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

function SocialNextAuthForm(props: {
  provider: 'apple' | 'google'
  callbackUrl: string
  csrfToken: string
  className: string
  children: React.ReactNode
}) {
  if (!props.csrfToken) return null
  return (
    <form action={`/api/auth/signin/${props.provider}`} method="POST" className="contents">
      <input type="hidden" name="csrfToken" value={props.csrfToken} />
      <input type="hidden" name="callbackUrl" value={props.callbackUrl} />
      <button type="submit" className={props.className}>
        {props.children}
      </button>
    </form>
  )
}

function SocialRedirectLink(props: { href: string; className: string; children: React.ReactNode }) {
  return (
    <a href={props.href} className={props.className}>
      {props.children}
    </a>
  )
}

function SocialBrandIcon({ method }: { method: SignInSocialMethod }) {
  if (method === 'kakao') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#191919]/10 text-[11px] font-black text-[#191919]">
        talk
      </span>
    )
  }
  if (method === 'naver') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/20 text-sm font-black text-white">
        N
      </span>
    )
  }
  if (method === 'apple') {
    return (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
    )
  }
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function socialButtonClass(method: SignInSocialMethod): string {
  switch (method) {
    case 'kakao':
      return `${SOCIAL_BUTTON_BASE} bg-[#FEE500] text-[#191919] hover:brightness-[0.98] focus-visible:outline-[#FEE500] shadow-[0_8px_24px_rgba(254,229,0,0.35)]`
    case 'naver':
      return `${SOCIAL_BUTTON_BASE} bg-[#03C75A] text-white hover:bg-[#02b351] focus-visible:outline-[#03C75A] shadow-[0_8px_24px_rgba(3,199,90,0.28)]`
    case 'apple':
      return `${SOCIAL_BUTTON_BASE} bg-[#111111] text-white hover:bg-black focus-visible:outline-neutral-800 shadow-[0_8px_24px_rgba(0,0,0,0.18)]`
    case 'google':
      return `${SOCIAL_BUTTON_BASE} border border-bt-border-soft bg-white text-bt-strong hover:bg-bt-page focus-visible:outline-bt-brand-blue-strong shadow-sm`
    default:
      return SOCIAL_BUTTON_BASE
  }
}

function renderSocialButton(
  method: SignInSocialMethod,
  callbackUrl: string,
  csrfToken: string,
) {
  const def = SIGN_IN_METHOD_DEFINITIONS[method]
  const className = socialButtonClass(method)
  const inner = (
    <>
      <SocialBrandIcon method={method} />
      <span>{def.ctaLabel}</span>
    </>
  )

  if (def.kind === 'nextauth_form' && def.nextAuthProvider) {
    return (
      <SocialNextAuthForm
        key={method}
        provider={def.nextAuthProvider}
        callbackUrl={callbackUrl}
        csrfToken={csrfToken}
        className={className}
      >
        {inner}
      </SocialNextAuthForm>
    )
  }

  return (
    <SocialRedirectLink key={method} href={buildSignInMethodHref(method, callbackUrl)} className={className}>
      {inner}
    </SocialRedirectLink>
  )
}

/**
 * 로그인 메인 — 소셜 4종(국내·글로벌) + 이메일 진입.
 * OAuth는 `<a>`·`<form POST>`만 사용(Next.js Link fetch 회피).
 */
export default function SignInSocialPanel({
  callbackUrl,
  csrfToken,
  socialOptions,
  emailEnabled,
}: Props) {
  const enabledSocial = socialOptions.filter((o) => o.enabled)
  const domestic = enabledSocial.filter((o) => SIGN_IN_METHOD_DEFINITIONS[o.id].section === 'domestic')
  const global = enabledSocial.filter((o) => SIGN_IN_METHOD_DEFINITIONS[o.id].section === 'global')

  if (enabledSocial.length === 0 && !emailEnabled) {
    return <p className="text-center text-xs text-bt-meta">사용 가능한 로그인 방법이 없습니다.</p>
  }

  return (
    <div className="w-full max-w-sm">
      {domestic.length > 0 ? (
        <section className="mb-5">
          <p className="mb-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-bt-meta">
            국내 계정
          </p>
          <div className="flex flex-col gap-2.5">
            {domestic.map((o) => renderSocialButton(o.id, callbackUrl, csrfToken))}
          </div>
        </section>
      ) : null}

      {global.length > 0 ? (
        <section className={domestic.length > 0 ? 'mb-5' : 'mb-5'}>
          <p className="mb-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-bt-meta">
            Apple · Google
          </p>
          <div className="flex flex-col gap-2.5">
            {global.map((o) => renderSocialButton(o.id, callbackUrl, csrfToken))}
          </div>
        </section>
      ) : null}

      {emailEnabled ? (
        <div className="pt-1">
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-bt-border-soft" aria-hidden />
            <span className="text-xs font-medium text-bt-meta">또는</span>
            <span className="h-px flex-1 bg-bt-border-soft" aria-hidden />
          </div>
          <Link
            href={buildSignInMethodHref('email', callbackUrl)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-bt-border-strong bg-bt-surface px-4 text-sm font-semibold text-bt-strong transition hover:border-bt-brand-blue-strong hover:bg-bt-brand-blue-soft/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-brand-blue-strong"
          >
            <EmailIcon />
            이메일로 로그인
          </Link>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-bt-meta">
            기존 이메일·ID 가입 회원은 여기서 로그인하세요.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function EmailIcon() {
  return (
    <svg className="h-4 w-4 text-bt-brand-blue-strong" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 8l8 5 8-5M4 8v8l8 5 8-5V8" />
    </svg>
  )
}

export type { SignInMethod } from '@/lib/auth/sign-in-method-catalog'