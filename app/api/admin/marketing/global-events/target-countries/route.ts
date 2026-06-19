import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import {
  parseCurationEventTargetMode,
  parseTargetCountriesInput,
  previewCurationEventTargetCountries,
} from '@/lib/bong-marketing/curation-event-target-countries'

export const dynamic = 'force-dynamic'

/** GET /api/admin/marketing/global-events/target-countries — 갱신 대상 국가 미리보기 */
export async function GET(request: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const targetMode = parseCurationEventTargetMode(searchParams.get('targetMode')) ?? 'union'
  const rawCountries = searchParams.get('targetCountries')?.trim()
  const targetCountries = rawCountries
    ? parseTargetCountriesInput(rawCountries.split(',').map((s) => s.trim()))
    : undefined

  try {
    const preview = await previewCurationEventTargetCountries({
      targetMode,
      targetCountries,
    })
    return NextResponse.json({
      targetMode: preview.targetMode,
      countries: preview.countries,
      count: preview.countries.length,
      usedProductFallback: preview.usedProductFallback ?? false,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    )
  }
}
