import { auth } from '@/auth'
import { SimplyurMyEsimClient } from '@/components/simplyur/SimplyurMyEsimClient'
import { notFound, redirect } from 'next/navigation'
import { isSimplyurLocale, simplyurPath, type SimplyurLocale } from '@/lib/simplyur/constants'

type Props = { params: Promise<{ locale: string }> }

/** design_handoff_my_esim — server auth gate + client orders UI */
// REGRESSION-FREEZE[simplyur-my-esim-server-auth-gate]: auth() redirect before client 401 UI — manifest
export default async function SimplyurMyEsimPage({ params }: Props) {
  const { locale: raw } = await params
  if (!isSimplyurLocale(raw)) notFound()
  const locale = raw as SimplyurLocale

  const session = await auth()
  const email = session?.user?.email?.trim() ?? ''
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? '').trim()
  const myEsimPath = simplyurPath(locale, '/my-esim')

  if (!email && !userId) {
    redirect(`${simplyurPath(locale, '/sign-in')}?callbackUrl=${encodeURIComponent(myEsimPath)}`)
  }

  return <SimplyurMyEsimClient />
}
