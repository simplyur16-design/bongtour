import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import * as logStream from '@/lib/admin-log-stream'

/**
 * GET /api/admin/logs/stream. 인증: 관리자.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  const encoder = new TextEncoder()
  let unsub: (() => void) | null = null
  let keepAlive: ReturnType<typeof setInterval> | null = null
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch {
          // client closed
        }
      }
      logStream.getLines().forEach((entry) => {
        send(JSON.stringify({ level: entry.level, text: entry.text, ts: entry.ts }))
      })
      unsub = logStream.subscribe((entry) => {
        send(JSON.stringify({ level: entry.level, text: entry.text, ts: entry.ts }))
      })
      keepAlive = setInterval(() => send('{}'), 25000)
    },
    cancel() {
      if (keepAlive) clearInterval(keepAlive)
      unsub?.()
    },
  })
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
