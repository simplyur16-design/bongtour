import { getBongtourCronSecret, isAuthorizedCronRequest } from '@/lib/cron-auth'
import { sweepDueModetourProducts } from '@/lib/modetour-sweep'
import { prisma } from '@/lib/prisma'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!getBongtourCronSecret()) {
    return jsonWithLeakGuard({ error: 'cron_secret_unconfigured' }, 'cron-modetour-sweep', { status: 401 })
  }
  if (!isAuthorizedCronRequest(req)) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'cron-modetour-sweep', { status: 401 })
  }

  const url = new URL(req.url)
  const productNo = url.searchParams.get('productNo')?.trim() || null
  const limitRaw = url.searchParams.get('limit')
  const limit = limitRaw != null ? Number.parseInt(limitRaw, 10) : undefined

  try {
    const defaultLimit = 200
    const result = await sweepDueModetourProducts(prisma, {
      limit: Number.isFinite(limit) && limit! > 0 ? limit : defaultLimit,
      productNo,
    })
    return jsonWithLeakGuard({ ok: true, ...result }, 'cron-modetour-sweep.response')
  } catch (e) {
    console.error('[cron/modetour-sweep]', e)
    return jsonWithLeakGuard({ ok: false, error: 'sweep_failed' }, 'cron-modetour-sweep', { status: 500 })
  }
}
