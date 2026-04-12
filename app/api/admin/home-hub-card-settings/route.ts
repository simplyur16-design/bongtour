import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { isValidCardKey } from '@/lib/home-hub-candidates'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import type { HomeHubCardImageSourceMode } from '@/lib/home-hub-card-hybrid-core'
import { writeHomeHubActiveMerged, type WriteHomeHubActiveMergedInput } from '@/lib/home-hub-resolve-images'

export async function PATCH(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    images?: Record<string, unknown>
    imageSourceModes?: Record<string, unknown>
  }

  const updatedBy =
    (admin.user as { email?: string | null }).email?.trim() ||
    admin.user.id ||
    'admin'

  const patch: WriteHomeHubActiveMergedInput = { lastUpdatedBy: updatedBy }

  if (body.images && typeof body.images === 'object' && !Array.isArray(body.images)) {
    const images: Partial<Record<HomeHubCardImageKey, string>> = {}
    for (const [k, v] of Object.entries(body.images)) {
      if (!isValidCardKey(k)) continue
      if (typeof v === 'string') images[k] = v
    }
    patch.images = images
  }

  if (body.imageSourceModes && typeof body.imageSourceModes === 'object' && !Array.isArray(body.imageSourceModes)) {
    const imageSourceModes: Partial<Record<HomeHubCardImageKey, HomeHubCardImageSourceMode>> = {}
    for (const [k, v] of Object.entries(body.imageSourceModes)) {
      if (!isValidCardKey(k)) continue
      if (v === 'manual' || v === 'product_pool') imageSourceModes[k] = v
    }
    patch.imageSourceModes = imageSourceModes
  }

  if (!patch.images && !patch.imageSourceModes) {
    return NextResponse.json({ ok: false, error: 'images 또는 imageSourceModes 가 필요합니다.' }, { status: 400 })
  }

  try {
    const active = writeHomeHubActiveMerged(patch)
    return NextResponse.json({ ok: true, active })
  } catch (e) {
    console.error('[home-hub-card-settings]', e)
    return NextResponse.json({ ok: false, error: '설정 저장에 실패했습니다.' }, { status: 500 })
  }
}
