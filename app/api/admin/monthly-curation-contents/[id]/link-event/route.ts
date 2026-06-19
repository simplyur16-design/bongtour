import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { linkCurationEventToSeasonCard } from '@/lib/bong-marketing/curation-event-card-link'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const { id: cardId } = await params
  if (!cardId) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }

  const eventId =
    typeof (body as Record<string, unknown>)?.eventId === 'string'
      ? (body as Record<string, string>).eventId.trim()
      : ''
  if (!eventId) {
    return NextResponse.json({ error: 'eventId가 필요합니다.' }, { status: 400 })
  }

  try {
    const { event, previousCardId } = await linkCurationEventToSeasonCard(cardId, eventId)
    return NextResponse.json({
      ok: true,
      event,
      previousCardId,
      movedFromOtherCard: Boolean(previousCardId && previousCardId !== cardId),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown'
    const status = message.includes('찾을 수 없') ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
