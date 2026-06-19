import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { refreshCurationEvents } from '@/lib/bong-marketing/curation-event-collector'
import {
  parseCurationEventTargetMode,
  parseTargetCountriesInput,
} from '@/lib/bong-marketing/curation-event-target-countries'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** POST /api/admin/marketing/global-events/refresh — CurationEvent 수동 갱신 (URL 호환) */
export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  let body: unknown = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text) as unknown
  } catch {
    return NextResponse.json({ error: 'JSON 본문 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const record = (body ?? {}) as Record<string, unknown>
  const targetMode = parseCurationEventTargetMode(record.targetMode)
  const targetCountries = parseTargetCountriesInput(record.targetCountries)

  try {
    const result = await refreshCurationEvents({
      ...(targetMode ? { targetMode } : {}),
      ...(targetCountries ? { targetCountries } : {}),
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    )
  }
}
