import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { loadAutoReplyProduct } from '@/lib/talktalk-autoreply/load-product'
import { decideTalktalkAutoReply, extractProductRef, toNaverSendEvent } from '@/lib/talktalk-autoreply/reply'

export const dynamic = 'force-dynamic'

/**
 * 관리자 자동답변 미리보기. 고객에게 보내지 않고 답변 화면용 JSON만 돌려준다.
 * 자동답변 안전장치: 미리보기는 발송 없음
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  let body: { text?: unknown; productRef?: unknown; hasImage?: unknown } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: '본문을 읽지 못했습니다.' }, { status: 400 })
  }
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const ref = (typeof body.productRef === 'string' && body.productRef.trim()) || extractProductRef(text)
  const product = await loadAutoReplyProduct(ref)
  const decision = decideTalktalkAutoReply({ text, hasImage: body.hasImage === true, product })
  return NextResponse.json({
    sent: false,
    productRef: ref,
    productFound: Boolean(product),
    decision,
    naverEvents: decision.messages.map((m) => toNaverSendEvent('PREVIEW_USER', m)),
  })
}
