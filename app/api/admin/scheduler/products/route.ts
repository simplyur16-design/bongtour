import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

const HANATOUR_BASE = process.env.HANATOUR_BASE_URL ?? 'https://www.hanatour.com'
const MODETOUR_BASE = process.env.MODETOUR_BASE_URL ?? 'https://www.modetour.com'
const VERYGOODTOUR_BASE = process.env.VERYGOODTOUR_BASE_URL ?? 'https://www.verygoodtour.com'
const YBTOUR_PRDT_BASE =
  process.env.YBTOUR_PRDT_BASE_URL?.replace(/\/$/, '') ??
  process.env.YELLOWBALLOON_PRDT_BASE_URL?.replace(/\/$/, '') ??
  'https://prdt.ybtour.co.kr'

function buildDetailUrl(originSource: string, originCode: string): string {
  const code = encodeURIComponent(originCode.trim())
  const src = (originSource || '').toLowerCase()
  if (src.includes('모두') || src === 'modetour') {
    return `${MODETOUR_BASE.replace(/\/$/, '')}/package/detail?pkgCd=${code}`
  }
  if (src.includes('참좋은') || src.includes('verygoodtour')) {
    return `${VERYGOODTOUR_BASE.replace(/\/$/, '')}/Product/PackageDetail?ProCode=${code}&PriceSeq=1&MenuCode=leaveLayer`
  }
  if (src.includes('노랑풍선') || src.includes('ybtour') || src.includes('yellowballoon') || src === 'yellow') {
    const c = (originCode ?? '').trim()
    if (c) {
      return `${YBTOUR_PRDT_BASE}/product/detailPackage?goodsCd=${encodeURIComponent(c)}&menu=PKG`
    }
    return `${(process.env.YBTOUR_BASE_URL ?? process.env.YELLOWBALLOON_BASE_URL)?.replace(/\/$/, '') ?? 'https://www.ybtour.co.kr'}/`
  }
  return `${HANATOUR_BASE.replace(/\/$/, '')}/package/detail?pkgCd=${code}`
}

function toSite(originSource: string): 'hanatour' | 'modetour' | 'verygoodtour' | 'ybtour' {
  const s = (originSource || '').toLowerCase()
  if (s.includes('모두') || s === 'modetour') return 'modetour'
  if (s.includes('참좋은') || s.includes('verygoodtour')) return 'verygoodtour'
  if (s.includes('노랑') || s.includes('ybtour') || s.includes('yellowballoon') || s === 'yellow') return 'ybtour'
  return 'hanatour'
}

/**
 * GET /api/admin/scheduler/products. 인증: 관리자.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const [queued, allProducts] = await Promise.all([
      prisma.scraperQueue.findMany({
        orderBy: { createdAt: 'asc' },
        select: { productId: true },
      }),
      prisma.product.findMany({
        orderBy: { updatedAt: 'asc' },
        select: { id: true, originCode: true, originSource: true },
      }),
    ])
    const queuedIds = new Set(queued.map((q) => q.productId))
    const inQueue = allProducts.filter((p) => queuedIds.has(p.id))
    const rest = allProducts.filter((p) => !queuedIds.has(p.id))
    const products = [...inQueue, ...rest]
    const list = products.map((p) => ({
      id: p.id,
      originCode: p.originCode,
      originSource: p.originSource,
      site: toSite(p.originSource),
      detailUrl: buildDetailUrl(p.originSource, p.originCode),
    }))
    return NextResponse.json(list)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
