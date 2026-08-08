'use client'

import { useEffect, useMemo } from 'react'
import { simplyurMobileDeepLink } from '@/lib/auth/simplyur-oauth-callback'
import { simplyurOAuthCompleteEmailQuery } from '@/lib/simplyur/checkout/session-buyer-email'
import type { SimplyurLocale } from '@/lib/simplyur/constants'

type Props = {
  locale: SimplyurLocale
  signedIn: boolean
  accountEmail?: string | null
  labels: {
    title: string
    body: string
    openApp: string
    retrySignIn: string
  }
  signInHref: string
  myEsimHref: string
}

function appOAuthCompleteHref(locale: SimplyurLocale, accountEmail?: string | null): string {
  return simplyurMobileDeepLink(
    `oauth-complete?status=success&locale=${encodeURIComponent(locale)}${simplyurOAuthCompleteEmailQuery(accountEmail)}`,
  )
}

/** OAuth 완료 — 앱 returnTo=app 시 simplyur://oauth-complete 로 복귀 */
export function SimplyurOAuthCompleteClient({
  locale,
  signedIn,
  accountEmail = null,
  labels,
  signInHref,
  myEsimHref,
}: Props) {
  const deepLink = useMemo(() => appOAuthCompleteHref(locale, accountEmail), [locale, accountEmail])

  useEffect(() => {
    if (!signedIn) return
    window.location.replace(deepLink)
  }, [signedIn, deepLink])

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
        href={deepLink}
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
