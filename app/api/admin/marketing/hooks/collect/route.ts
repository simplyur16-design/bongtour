import { NextResponse } from 'next/server'
import { collectHooksFromNaver } from '@/lib/bong-marketing/hook-collector'
import { requireAdmin } from '@/lib/require-admin'

export const maxDuration = 300

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json()
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * POST /api/admin/marketing/hooks/collect
 */
export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const body = (await readJson(req)) ?? {}
  const topKeywordGroups =
    typeof body.topKeywordGroups === 'number' && body.topKeywordGroups > 0
      ? Math.min(5, Math.floor(body.topKeywordGroups))
      : undefined
  const itemsPerKeyword =
    typeof body.itemsPerKeyword === 'number' && body.itemsPerKeyword > 0
      ? Math.min(100, Math.floor(body.itemsPerKeyword))
      : undefined

  try {
    const result = await collectHooksFromNaver({ topKeywordGroups, itemsPerKeyword })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '후킹 수집 실패' },
      { status: 500 },
    )
  }
}
