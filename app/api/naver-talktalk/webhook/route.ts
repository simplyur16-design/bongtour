import { NextResponse } from 'next/server'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { loadAutoReplyProduct } from '@/lib/talktalk-autoreply/load-product'
import { decideTalktalkAutoReply, extractProductRef, toNaverSendEvent } from '@/lib/talktalk-autoreply/reply'

/**
 * 네이버 톡톡 파트너센터 Webhook URL 등록·이벤트 수신.
 * 1단계: 등록 검증 통과용 — POST JSON 수신, 로그, `{ ok: true }` 200 만 수행.
 * 2단계(11/22): 자동답변 판단(상품 사진·설명·FAQ, 미해결 시 상담원 연결).
 *   기본은 판단 기록만 하고 고객에게 보내지 않는다. NAVER_TALKTALK_AUTOREPLY=live 일 때만 동기 응답으로 답한다.
 *   상담원 연결(handover passThread)은 live + NAVER_TALKTALK_SEND_API_KEY 가 있을 때만 호출한다.
 * 자동답변 안전장치: 기본 발송 꺼짐
 *
 * @see 네이버 톡톡 파트너센터 — Webhook URL, 이벤트(open / send / friend 권장)
 */
export const dynamic = 'force-dynamic'

function parseLooseJsonBody(text: string): unknown {
  const t = text.trim()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return { _raw: t.slice(0, 2000) }
  }
}

export async function GET(): Promise<NextResponse> {
  return jsonWithLeakGuard({ ok: true }, 'naver-talktalk.webhook', {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown = null
  try {
    const raw = await request.text()
    body = parseLooseJsonBody(raw)
  } catch {
    body = { _parseError: true }
  }

  const evt = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const live = process.env.NAVER_TALKTALK_AUTOREPLY === 'live'
  let reply: Record<string, unknown> | null = null
  if (evt.event === 'send' && typeof evt.user === 'string') {
    try {
      const text = String((evt.textContent as { text?: unknown } | undefined)?.text ?? '')
      const product = await loadAutoReplyProduct(extractProductRef(text))
      const decision = decideTalktalkAutoReply({
        text,
        hasImage: Boolean(evt.imageContent),
        standby: evt.standby === true,
        product,
      })
      console.log('[naver-talktalk-autoreply]', { mode: decision.mode, reason: decision.reason, faq: decision.faqIds, live })
      if (live && decision.messages[0]) reply = toNaverSendEvent(evt.user, decision.messages[0])
      if (live && decision.handover) void passThreadToPartner(evt.user)
    } catch (e) {
      console.warn('[naver-talktalk-autoreply] skip', e instanceof Error ? e.message : 'error')
    }
  } else {
    console.log('[naver-talktalk-webhook]', { event: evt.event ?? null })
  }

  return jsonWithLeakGuard(
    reply ?? { ok: true },
    'naver-talktalk.webhook',
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  )
}

/** 상담원에게 대화 주도권 넘기기. live 이고 키가 있을 때만. 실패해도 웹훅 응답은 막지 않는다. */
async function passThreadToPartner(user: string): Promise<void> {
  const key = process.env.NAVER_TALKTALK_SEND_API_KEY
  if (!key) return
  try {
    await fetch('https://gw.talk.naver.com/chatbot/v1/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8', Authorization: key },
      body: JSON.stringify({ event: 'handover', user, options: { control: 'passThread', targetId: 1 } }),
      signal: AbortSignal.timeout(4000),
    })
  } catch {
    console.warn('[naver-talktalk-autoreply] handover skip')
  }
}
