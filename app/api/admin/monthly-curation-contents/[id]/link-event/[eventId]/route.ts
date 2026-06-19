import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { unlinkCurationEventFromSeasonCard } from '@/lib/bong-marketing/curation-event-card-link'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { id: cardId, eventId } = await params
  if (!cardId || !eventId) {
    return NextResponse.json({ error: 'id와 eventId가 필요합니다.' }, { status: 400 })
  }

  try {
    await unlinkCurationEventFromSeasonCard(cardId, eventId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown'
    const status = message.includes('찾을 수 없') ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
