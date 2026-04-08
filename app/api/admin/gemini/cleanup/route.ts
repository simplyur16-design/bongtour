import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { prisma } from '@/lib/prisma'
import { runGeminiCleanup, GEMINI_CLEANUP_GRACE_DAYS } from '@/lib/gemini-cleanup'

export type GeminiCleanupResponse =
  | { ok: true; dryRun: boolean; scannedCount: number; preservedCount: number; deletedCount: number; deletedFiles: string[] }
  | { ok: false; error: string }

/**
 * POST /api/admin/gemini/cleanup
 * 관리자 전용. 참조되지 않고 유예기간이 지난 Gemini 업로드 파일 삭제.
 *
 * 원칙: Product.bgImageUrl에 저장된 경로(참조 중인 파일)는 절대 삭제하지 않는다.
 * body.dryRun === true 이면 삭제하지 않고 삭제 대상만 반환. 실제 실행 전 dry-run 권장.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: '인증이 필요합니다.' } satisfies GeminiCleanupResponse,
      { status: 401 }
    )
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const dryRun = body.dryRun === true
    const graceDays =
      typeof body.graceDays === 'number' && body.graceDays >= 1 && body.graceDays <= 90
        ? body.graceDays
        : GEMINI_CLEANUP_GRACE_DAYS

    const result = await runGeminiCleanup(prisma, { dryRun, graceDays })

    return NextResponse.json({
      ok: true,
      dryRun: result.dryRun,
      scannedCount: result.scannedCount,
      preservedCount: result.preservedCount,
      deletedCount: result.deletedCount,
      deletedFiles: result.deletedFiles,
    } satisfies GeminiCleanupResponse)
  } catch (e) {
    console.error('[gemini/cleanup]', e)
    return NextResponse.json(
      { ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' } satisfies GeminiCleanupResponse,
      { status: 500 }
    )
  }
}
