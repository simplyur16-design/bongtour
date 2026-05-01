import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { isValidCardKey } from '@/lib/home-hub-candidates'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import { isHomeHubPublicManualImageUrl, type HomeHubCardImageSourceMode } from '@/lib/home-hub-card-hybrid-core'
import {
  writeHomeHubActiveMerged,
  type MobileMainServiceTileKey,
  type WriteHomeHubActiveMergedInput,
} from '@/lib/home-hub-resolve-images'

const MOBILE_TILE_KEYS = new Set<MobileMainServiceTileKey>(['overseas', 'airHotel', 'privateTrip', 'training'])

export async function PATCH(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    images?: Record<string, unknown>
    imageSourceModes?: Record<string, unknown>
    trainingPageSecondaryImage?: unknown
    mobileMainServiceTiles?: Record<string, unknown>
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

  if (body.trainingPageSecondaryImage !== undefined) {
    if (body.trainingPageSecondaryImage === null) {
      patch.trainingPageSecondaryImage = null
    } else if (typeof body.trainingPageSecondaryImage === 'string') {
      patch.trainingPageSecondaryImage = body.trainingPageSecondaryImage
    }
  }

  if (body.mobileMainServiceTiles && typeof body.mobileMainServiceTiles === 'object' && !Array.isArray(body.mobileMainServiceTiles)) {
    const mobileMainServiceTiles: Partial<Record<MobileMainServiceTileKey, string>> = {}
    for (const [k, v] of Object.entries(body.mobileMainServiceTiles)) {
      if (!MOBILE_TILE_KEYS.has(k as MobileMainServiceTileKey)) continue
      if (typeof v !== 'string') continue
      const t = v.trim()
      if (t && !isHomeHubPublicManualImageUrl(t)) {
        return NextResponse.json(
          { ok: false, error: `mobileMainServiceTiles.${k} 는 /images/... 또는 http(s):// 공개 URL만 허용됩니다.` },
          { status: 400 },
        )
      }
      mobileMainServiceTiles[k as MobileMainServiceTileKey] = t
    }
    if (Object.keys(mobileMainServiceTiles).length > 0) {
      patch.mobileMainServiceTiles = mobileMainServiceTiles
    }
  }

  if (
    !patch.images &&
    !patch.imageSourceModes &&
    patch.trainingPageSecondaryImage === undefined &&
    !patch.mobileMainServiceTiles
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'images, imageSourceModes, trainingPageSecondaryImage, mobileMainServiceTiles 중 하나가 필요합니다.',
      },
      { status: 400 },
    )
  }

  try {
    const active = writeHomeHubActiveMerged(patch)
    return NextResponse.json({ ok: true, active })
  } catch (e) {
    console.error('[home-hub-card-settings]', e)
    return NextResponse.json({ ok: false, error: '설정 저장에 실패했습니다.' }, { status: 500 })
  }
}
