import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { OVERSEAS_LOCATION_TREE_CLEAN } from '@/lib/overseas-location-tree'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/overseas-tree — 코드 SSOT(`lib/overseas-location-tree`) 트리.
 * 메가메뉴 타입과 동일한 형태로 반환합니다.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  return NextResponse.json({ tree: OVERSEAS_LOCATION_TREE_CLEAN })
}
