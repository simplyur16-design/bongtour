import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import AffiliationCardClient from '@/components/mypage/AffiliationCardClient'
import { getLatestAffiliationCardForUser } from '@/lib/bongsim/affiliation/affiliation-card-service'

export const dynamic = 'force-dynamic'

export default async function MyPageAffiliationCardPage() {
  const session = await auth()
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? '').trim()
  if (!userId) {
    redirect('/auth/signin?callbackUrl=/mypage/affiliation')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      affiliationVerified: true,
      affiliationVerifiedAt: true,
      affiliationOrgName: true,
      affiliationCardImageUrl: true,
    },
  })
  if (!user) {
    redirect('/auth/signin?callbackUrl=/mypage/affiliation')
  }

  const latest = await getLatestAffiliationCardForUser(userId)

  return (
    <AffiliationCardClient
      initial={{
        affiliationVerified: user.affiliationVerified,
        affiliationVerifiedAt: user.affiliationVerifiedAt?.toISOString() ?? null,
        affiliationOrgName: user.affiliationOrgName,
        affiliationCardImageUrl: user.affiliationCardImageUrl,
        latest: latest
          ? {
              id: latest.id,
              status: latest.status,
              imageUrl: latest.imageUrl,
              ocrName: latest.ocrName,
              ocrCompany: latest.ocrCompany,
              ocrEmail: latest.ocrEmail,
              ocrPhone: latest.ocrPhone,
              ocrPosition: latest.ocrPosition,
              createdAt: latest.createdAt.toISOString(),
              reviewedAt: latest.reviewedAt?.toISOString() ?? null,
              adminNote: latest.adminNote,
            }
          : null,
      }}
    />
  )
}
