import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import {
  parsePrivateTripHeroSlidesFile,
  readPrivateTripHeroSlidesFile,
  writePrivateTripHeroSlidesFile,
  type PrivateTripHeroSlide,
} from '@/lib/private-trip-hero-slides'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  return NextResponse.json({ ok: true, file: readPrivateTripHeroSlidesFile() })
}

export async function PUT(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { slides?: unknown }
  if (!Array.isArray(body.slides)) {
    return NextResponse.json({ ok: false, error: 'slides 배열이 필요합니다.' }, { status: 400 })
  }

  const parsed = parsePrivateTripHeroSlidesFile({ slides: body.slides })
  const updatedBy =
    (admin.user as { email?: string | null }).email?.trim() || admin.user.id || 'admin'

  const toWrite: PrivateTripHeroSlide[] = parsed.slides.map((s) => ({
    imageUrl: s.imageUrl,
    headline: s.headline,
    caption: s.caption,
    linkHref: s.linkHref,
  }))

  try {
    const file = writePrivateTripHeroSlidesFile({ slides: toWrite, lastUpdatedBy: updatedBy })
    return NextResponse.json({ ok: true, file })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '저장에 실패했습니다.'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
