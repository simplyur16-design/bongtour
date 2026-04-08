import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  parseScopeQuery,
  parseYearMonthQuery,
  toPublicCurationCard,
} from '@/lib/monthly-curation'
import { assertNoInternalMetaLeak } from '@/lib/public-response-guard'

/**
 * GET /api/curations/monthly
 * 공개: `status === 'published'` 이고 `isActive === true` 인 카드만.
 *
 * Query:
 * - `scope`: `domestic` | `overseas` (선택, 없으면 scope 무필터)
 * - `yearMonth`: `YYYY-MM` (선택, 없으면 월 무필터)
 *
 * 정렬: `sortOrder` asc → `updatedAt` desc
 *
 * 보안: draft / 비활성 / 내부 메타 미노출. Rate limit·캡차는 추후(공개 API).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scopeParsed = parseScopeQuery(searchParams.get('scope'))
  if (scopeParsed === 'INVALID') {
    return NextResponse.json(
      { ok: false, error: 'scope는 domestic 또는 overseas 이어야 합니다.' },
      { status: 400 }
    )
  }

  const ymParsed = parseYearMonthQuery(searchParams.get('yearMonth'))
  if (ymParsed === 'INVALID') {
    return NextResponse.json(
      { ok: false, error: 'yearMonth는 YYYY-MM 형식이어야 합니다.' },
      { status: 400 }
    )
  }

  const where = {
    status: 'published' as const,
    isActive: true,
    ...(scopeParsed ? { scope: scopeParsed } : {}),
    ...(ymParsed ? { yearMonth: ymParsed } : {}),
  }

  const monthlyDelegate = prisma.monthlyCurationItem
  if (!monthlyDelegate || typeof monthlyDelegate.findMany !== 'function') {
    const modelKeys = prisma
      ? Object.keys(prisma).filter((k) => !k.startsWith('$') && !k.startsWith('_'))
      : []
    console.error('[GET /api/curations/monthly] Prisma delegate `monthlyCurationItem` missing.', {
      hasPrisma: Boolean(prisma),
      modelKeyCount: modelKeys.length,
      modelKeysSample: modelKeys.slice(0, 25),
      hint: 'Run `npx prisma generate`, ensure schema includes MonthlyCurationItem, restart `next dev`. If persist, verify next.config server alias `@prisma/client` -> prisma-gen-runtime.',
    })
    return NextResponse.json(
      {
        ok: false,
        error: '큐레이션 서비스를 일시적으로 사용할 수 없습니다.',
      },
      { status: 503 }
    )
  }

  try {
    const rows = await monthlyDelegate.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        yearMonth: true,
        scope: true,
        destinationName: true,
        oneLineTheme: true,
        whyNowText: true,
        recommendedForText: true,
        leadTimeLabel: true,
        primaryInquiryType: true,
        briefingSourceType: true,
        linkedProductId: true,
        sortOrder: true,
      },
    })

    const items = rows.map((r) => toPublicCurationCard(r))

    const payload = { ok: true, items }
    assertNoInternalMetaLeak(payload, '/api/curations/monthly')
    return NextResponse.json(payload)
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error('[GET /api/curations/monthly] findMany failed — 빈 목록으로 응답 (호출측 fetch 유지)', {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    })
    const fallback = { ok: true, items: [] }
    assertNoInternalMetaLeak(fallback, '/api/curations/monthly')
    return NextResponse.json(fallback)
  }
}
