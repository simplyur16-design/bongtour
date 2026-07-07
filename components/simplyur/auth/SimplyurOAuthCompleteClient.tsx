'use client'

import { useEffect } from 'react'
import { simplyurMobileDeepLink } from '@/lib/auth/simplyur-oauth-callback'
import type { SimplyurLocale } from '@/lib/simplyur/constants'

type Props = {
  locale: SimplyurLocale
  signedIn: boolean
  labels: {
    title: string
    body: string
    openApp: string
    retrySignIn: string
  }
  signInHref: string
  myEsimHref: string
}

/** OAuth 완료 — 앱 returnTo=app 시 simplyur://oauth-complete 로 복귀 */
export function SimplyurOAuthCompleteClient({
  locale,
  signedIn,
  labels,
  signInHref,
  myEsimHref,
}: Props) {
  useEffect(() => {
    if (!signedIn) return
    const deepLink = simplyurMobileDeepLink(`oauth-complete?status=success&locale=${encodeURIComponent(locale)}`)
    window.location.replace(deepLink)
  }, [signedIn, locale])

  if (!signedIn) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold text-[color:var(--su-ink)]">{labels.title}</h1>
        <p className="text-sm text-[color:var(--su-ink-muted)]">{labels.body}</p>
        <a
          href={signInHref}
          className="rounded-2xl bg-[color:var(--su-coral)] px-6 py-3 text-sm font-semibold text-white no-underline"
        >
          {labels.retrySignIn}
        </a>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-[color:var(--su-ink)]">{labels.title}</h1>
      <p className="text-sm text-[color:var(--su-ink-muted)]">{labels.body}</p>
      <a
        href={simplyurMobileDeepLink(`oauth-complete?status=success&locale=${encodeURIComponent(locale)}`)}
        className="rounded-2xl bg-[color:var(--su-coral)] px-6 py-3 text-sm font-semibold text-white no-underline"
      >
        {labels.openApp}
      </a>
      <a href={myEsimHref} className="text-sm text-[color:var(--su-ink-muted)] underline">
        Continue in browser
      </a>
    </main>
  )
}
