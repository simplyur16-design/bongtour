import { prisma } from '@/lib/prisma'
import IntegrationsClient from './IntegrationsClient'

export const dynamic = 'force-dynamic'

export type MetaConnectionPublic = {
  provider: string
  pageId: string | null
  pageName: string | null
  instagramBusinessId: string | null
  userTokenExpiresAt: Date
  connectedAt: Date
  lastRefreshedAt: Date | null
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const params = await searchParams

  let connection: MetaConnectionPublic | null = null
  try {
    connection = await prisma.bongMetaConnection.findUnique({
      where: { provider: 'meta' },
      select: {
        provider: true,
        pageId: true,
        pageName: true,
        instagramBusinessId: true,
        userTokenExpiresAt: true,
        connectedAt: true,
        lastRefreshedAt: true,
      },
    })
  } catch {
    connection = null
  }

  return (
    <IntegrationsClient
      connection={connection}
      successMsg={params.success}
      errorMsg={params.error}
    />
  )
}
