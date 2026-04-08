import { NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

/**
 * DELETE /api/admin/photo-pool/[id]. 인증: 관리자.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id } = await params
    const row = await prisma.photoPool.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: '해당 사진을 찾을 수 없습니다.' }, { status: 404 })
    }
    const filePath = row.filePath
    const absolutePath = path.join(process.cwd(), 'public', filePath.replace(/^\//, ''))
    try {
      await fs.unlink(absolutePath)
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.warn('photo-pool delete: 파일 삭제 실패', absolutePath, e)
      }
    }
    await prisma.photoPool.delete({ where: { id } })
    return NextResponse.json({ ok: true, deleted: id })
  } catch (e) {
    console.error('photo-pool DELETE:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
