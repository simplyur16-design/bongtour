import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import MarketingConsentClient from '@/components/mypage/MarketingConsentClient'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ returnTo?: string }>
}

function safeReturnPath(raw: string | undefined): string {
  const t = (raw ?? '/mypage').trim()
  if (!t.startsWith('/') || t.startsWith('//')) return '/mypage'
  return t
}

export default async function MyPageMarketingConsentPage({ searchParams }: Props) {
  const session = await auth()
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? '').trim()
  if (!userId) {
    redirect('/auth/signin?callbackUrl=/mypage/marketing-consent')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountStatus: true,
      marketingConsent: true,
      marketingConsentAt: true,
      marketingConsentVersion: true,
    },
  })

  if (!user) {
    redirect('/auth/signin?callbackUrl=/mypage/marketing-consent')
  }

  if (user.accountStatus === 'consent_pending') {
    redirect('/auth/signup/consent?callbackUrl=/mypage/marketing-consent')
  }

  if (user.accountStatus !== 'active') {
    redirect('/mypage')
  }

  const sp = await searchParams
  const returnTo = safeReturnPath(sp.returnTo)

  return (
    <MarketingConsentClient
      initial={{
        marketingConsent: user.marketingConsent,
        marketingConsentAt: user.marketingConsentAt?.toISOString() ?? null,
        marketingConsentVersion: user.marketingConsentVersion,
      }}
      returnTo={returnTo}
    />
  )
}
