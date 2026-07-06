import Link from 'next/link'
import {
  buildSignInMethodHref,
} from '@/lib/auth/sign-in-method-catalog'
import {
  SIMPLYUR_DOMESTIC_ESIM_HREF,
  SIMPLYUR_DOMESTIC_SIGNIN_HREF,
  type SimplyurLocale,
} from '@/lib/simplyur/constants'
import { simplyurPath } from '@/lib/simplyur/constants'

type Props = {
  locale: SimplyurLocale
  callbackUrl: string
  emailEnabled: boolean
  labels: {
    audienceBadge: string
    email: string
    appSocialHint: string
    domesticEsimLink: string
    domesticSignInLink: string
  }
}

/** simplyur 웹 — 외국인 방문객 전용. 이메일만(소셜은 앱). */
export function SimplyurSignInPanel({ locale, callbackUrl, emailEnabled, labels }: Props) {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="rounded-full border border-[color:var(--su-hanji-border)] bg-[color:var(--su-brand-bg-soft)] px-3 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-[color:var(--su-celadon)]">
        {labels.audienceBadge}
      </p>

      <p className="max-w-sm text-center text-sm leading-relaxed text-[color:var(--su-ink-muted)]">
        {labels.appSocialHint}
      </p>

      {emailEnabled ? (
        <Link
          href={buildSignInMethodHref('email', callbackUrl, { audience: 'globalWeb', simplyurLocale: locale })}
          className="flex h-12 w-full max-w-sm items-center justify-center rounded-xl border border-[color:var(--su-hanji-border)] bg-white px-4 text-sm font-semibold text-[color:var(--su-ink)] shadow-sm transition hover:bg-[color:var(--su-brand-bg-soft)]"
        >
          {labels.email}
        </Link>
      ) : null}

      <div className="max-w-sm space-y-2 text-center text-[11px] leading-relaxed text-[color:var(--su-ink-muted)]">
        <p>
          <Link href={SIMPLYUR_DOMESTIC_ESIM_HREF} className="font-medium text-[color:var(--su-celadon)] hover:underline">
            {labels.domesticEsimLink}
          </Link>
        </p>
        <p>
          <Link href={SIMPLYUR_DOMESTIC_SIGNIN_HREF} className="font-medium text-[color:var(--su-celadon)] hover:underline">
            {labels.domesticSignInLink}
          </Link>
        </p>
      </div>
    </div>
  )
}

export function SimplyurSignInBackLink({
  locale,
  callbackUrl,
  label,
}: {
  locale: SimplyurLocale
  callbackUrl: string
  label: string
}) {
  const href = `${simplyurPath(locale, '/sign-in')}?callbackUrl=${encodeURIComponent(callbackUrl)}`
  return (
    <Link
      href={href}
      className="mb-6 inline-flex items-center gap-1 text-sm text-[color:var(--su-ink-muted)] transition hover:text-[color:var(--su-celadon)]"
    >
      ← {label}
    </Link>
  )
}
