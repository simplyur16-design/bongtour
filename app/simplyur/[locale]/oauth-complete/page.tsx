import { auth } from '@/auth'
import { SimplyurOAuthCompleteClient } from '@/components/simplyur/auth/SimplyurOAuthCompleteClient'
import { notFound } from 'next/navigation'
import { isSimplyurLocale, simplyurPath, type SimplyurLocale } from '@/lib/simplyur/constants'
import { getSimplyurMessages, t } from '@/lib/simplyur/i18n'

type Props = { params: Promise<{ locale: string }> }

/** simplyur OAuth 완료 — 앱 returnTo=app 복귀 브릿지 */
export default async function SimplyurOAuthCompletePage({ params }: Props) {
  const { locale: raw } = await params
  if (!isSimplyurLocale(raw)) notFound()
  const locale = raw as SimplyurLocale

  const session = await auth()
  const signedIn = Boolean(session?.user)
  const messages = await getSimplyurMessages(locale)

  const myEsimHref = simplyurPath(locale, '/my-esim')
  const signInHref = `${simplyurPath(locale, '/sign-in')}?callbackUrl=${encodeURIComponent(myEsimHref)}`

  return (
    <SimplyurOAuthCompleteClient
      locale={locale}
      signedIn={signedIn}
      signInHref={signInHref}
      myEsimHref={myEsimHref}
      labels={{
        title: t(messages, 'auth.oauthCompleteTitle'),
        body: t(messages, 'auth.oauthCompleteBody'),
        openApp: t(messages, 'auth.oauthCompleteOpenApp'),
        retrySignIn: t(messages, 'auth.signInSubmit'),
      }}
    />
  )
}
