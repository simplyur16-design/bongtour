import { getBongtourCronSecret, isAuthorizedCronRequest } from '@/lib/cron-auth'
import { sweepDueHanatourProducts } from '@/lib/hanatour-sweep'
import { sweepDueKyowontourProducts } from '@/lib/kyowontour-sweep'
import { sweepDueLottetourProducts } from '@/lib/lottetour-sweep'
import { sweepDueModetourProducts } from '@/lib/modetour-sweep'
import { sweepDueVerygoodtourProducts } from '@/lib/verygoodtour-sweep'
import { sweepDueYbtourProducts } from '@/lib/ybtour-sweep'
import { prisma } from '@/lib/prisma'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 800

const SUPPLIERS = [
  'modetour',
  'hanatour',
  'ybtour',
  'lottetour',
  'verygoodtour',
  'kyowontour',
] as const

type SupplierKey = (typeof SUPPLIERS)[number]

function isSupplierKey(v: string): v is SupplierKey {
  return (SUPPLIERS as readonly string[]).includes(v)
}

/**
 * 6공급사 due 가격 sweep — worker cron과 동일 함수. 운영 즉시 재수집용.
 * Header: x-bongtour-cron-secret
 * Query: supplier=modetour|… (생략 시 6사 순차), limit=
 */
export async function POST(req: Request) {
  if (!getBongtourCronSecret()) {
    return jsonWithLeakGuard({ error: 'cron_secret_unconfigured' }, 'cron-supplier-daily-sweeps', {
      status: 401,
    })
  }
  if (!isAuthorizedCronRequest(req)) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'cron-supplier-daily-sweeps', { status: 401 })
  }

  const url = new URL(req.url)
  const limitRaw = url.searchParams.get('limit')
  const limit =
    limitRaw != null && Number.isFinite(Number.parseInt(limitRaw, 10))
      ? Math.max(1, Math.min(500, Number.parseInt(limitRaw, 10)))
      : 200
  const supplierRaw = (url.searchParams.get('supplier') ?? '').trim().toLowerCase()
  const targets: SupplierKey[] =
    supplierRaw && isSupplierKey(supplierRaw) ? [supplierRaw] : [...SUPPLIERS]

  const out: Record<string, unknown> = { ok: true, limit, suppliers: targets }
  try {
    for (const s of targets) {
      console.log(`[cron/supplier-daily-sweeps] ${s} start limit=${limit}`)
      const result =
        s === 'modetour'
          ? await sweepDueModetourProducts(prisma, { limit })
          : s === 'hanatour'
            ? await sweepDueHanatourProducts(prisma, { limit })
            : s === 'ybtour'
              ? await sweepDueYbtourProducts(prisma, { limit })
              : s === 'lottetour'
                ? await sweepDueLottetourProducts(prisma, { limit })
                : s === 'verygoodtour'
                  ? await sweepDueVerygoodtourProducts(prisma, { limit })
                  : await sweepDueKyowontourProducts(prisma, { limit })
      console.log(`[cron/supplier-daily-sweeps] ${s}`, result)
      out[s] = result
    }
    return jsonWithLeakGuard(out, 'cron-supplier-daily-sweeps.response')
  } catch (e) {
    console.error('[cron/supplier-daily-sweeps]', e)
    return jsonWithLeakGuard(
      { ok: false, error: 'sweep_failed', partial: out },
      'cron-supplier-daily-sweeps',
      { status: 500 },
    )
  }
}
