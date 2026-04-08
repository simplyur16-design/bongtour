import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

export type CheckOriginUrlMatch = {
  id: string
  title: string
  originSource: string
  registrationStatus: string | null
}

export type CheckOriginUrlResponse =
  | { ok: true; exists: boolean; matches: CheckOriginUrlMatch[] }
  | { ok: false; error: string }

const MAX_MATCHES = 3

/** 입력 URL을 비교용으로 정규화: trim, 끝 슬래시 제거 */
function normalizeOriginUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/**
 * GET /api/admin/products/check-origin-url?originUrl=...
 * 동일 originUrl로 등록된 상품이 있는지 검사. 관리자 전용.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: '인증이 필요합니다.' } satisfies CheckOriginUrlResponse,
      { status: 401 }
    )
  }

  try {
    const raw = req.nextUrl.searchParams.get('originUrl') ?? ''
    const normalized = normalizeOriginUrl(raw)

    if (!normalized) {
      return NextResponse.json({
        ok: true,
        exists: false,
        matches: [],
      } satisfies CheckOriginUrlResponse)
    }

    if (!/^https?:\/\//i.test(normalized)) {
      return NextResponse.json({
        ok: true,
        exists: false,
        matches: [],
      } satisfies CheckOriginUrlResponse)
    }

    const matches = await prisma.product.findMany({
      where: {
        OR: [{ originUrl: normalized }, { originUrl: normalized + '/' }],
      },
      take: MAX_MATCHES,
      select: {
        id: true,
        title: true,
        originSource: true,
        registrationStatus: true,
      },
    })

    return NextResponse.json({
      ok: true,
      exists: matches.length > 0,
      matches: matches.map((m) => ({
        id: m.id,
        title: m.title,
        originSource: m.originSource,
        registrationStatus: m.registrationStatus ?? null,
      })),
    } satisfies CheckOriginUrlResponse)
  } catch (e) {
    console.error('[check-origin-url]', e)
    return NextResponse.json(
      {
        ok: false,
        error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      } satisfies CheckOriginUrlResponse,
      { status: 500 }
    )
  }
}
