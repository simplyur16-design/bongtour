import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { clearPrimaryForEntity, insertImageAssetRow } from '@/lib/image-assets-db'
import { sourceTypeToSourceName } from '@/lib/image-asset-source'
import { requireAdmin } from '@/lib/require-admin'
import { prisma } from '@/lib/prisma'
import { savePhotoFromUrlWithRetry } from '@/lib/photo-pool'
import { getImageStorageBucket, isObjectStorageConfigured, tryParseObjectKeyFromPublicUrl } from '@/lib/object-storage'
import { isPexelsCdnUrl } from '@/lib/product-pexels-image-rehost'

const ENTITY_TYPE = 'bongsim_esim_country'
const IMAGE_ROLE = 'recommend_hero'
const SERVICE_TYPE = 'overseas'

type RouteParams = { params: Promise<{ code: string }> }

type PostBody = {
  imageUrl?: string
  entityNameKr?: string
  photographer?: string | null
  sourceUrl?: string | null
  pexelsPhotoId?: number | null
}

function safeCode(raw: string): string | null {
  const t = decodeURIComponent(String(raw ?? '').trim()).toLowerCase()
  if (!/^[a-z0-9-]{2,24}$/.test(t)) return null
  return t
}

function stemFromPublicUrl(publicUrl: string, storagePath: string): string {
  const key = storagePath || tryParseObjectKeyFromPublicUrl(publicUrl) || ''
  const seg = key.split('/').filter(Boolean).pop() || 'hero.webp'
  return seg.replace(/\.[a-z0-9]+$/i, '') || 'hero'
}

/**
 * POST /api/admin/bongsim/country-heroes/[code]
 * Body: { imageUrl, entityNameKr, photographer?, sourceUrl?, pexelsPhotoId? }
 * Pexels CDN URL → PhotoPool(Ncloud) → ImageAsset (recommend_hero, primary).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { code: codeParam } = await params
  const entityId = safeCode(codeParam ?? '')
  if (!entityId) {
    return NextResponse.json({ ok: false, error: '유효하지 않은 국가 코드입니다.' }, { status: 400 })
  }

  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }

  const imageUrl = String(body.imageUrl ?? '').trim()
  const entityNameKr = String(body.entityNameKr ?? '').trim().slice(0, 200)
  if (!imageUrl || !entityNameKr) {
    return NextResponse.json({ ok: false, error: 'imageUrl과 entityNameKr은 필수입니다.' }, { status: 400 })
  }
  if (!/^https:\/\//i.test(imageUrl)) {
    return NextResponse.json({ ok: false, error: 'imageUrl은 https여야 합니다.' }, { status: 400 })
  }
  if (!isPexelsCdnUrl(imageUrl)) {
    return NextResponse.json({ ok: false, error: 'Pexels CDN(images.pexels.com) URL만 허용됩니다.' }, { status: 400 })
  }

  if (!isObjectStorageConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Object Storage(NCLOUD_*)가 설정되지 않아 이미지를 저장할 수 없습니다.' },
      { status: 503 },
    )
  }

  const photographer = body.photographer != null ? String(body.photographer).trim().slice(0, 200) : ''
  const sourceUrl = body.sourceUrl != null ? String(body.sourceUrl).trim().slice(0, 2000) : ''
  const pid =
    body.pexelsPhotoId != null && Number.isFinite(Number(body.pexelsPhotoId))
      ? Math.floor(Number(body.pexelsPhotoId))
      : null

  const sourceNoteParts = [
    pid != null && pid > 0 ? `pexels_id:${pid}` : '',
    sourceUrl ? `page:${sourceUrl}` : '',
    photographer ? `by:${photographer}` : '',
  ].filter(Boolean)
  const sourceNote = sourceNoteParts.join(' · ').slice(0, 2000) || null

  try {
    const pooled = await savePhotoFromUrlWithRetry(prisma, imageUrl, entityNameKr, `bongsim_esim_${entityId}`, 'Pexels')
    if (!pooled) {
      return NextResponse.json(
        { ok: false, error: 'Pexels 이미지를 풀에 저장하지 못했습니다. 네트워크·URL을 확인해 주세요.' },
        { status: 503 },
      )
    }

    const publicUrl = String(pooled.filePath ?? '').trim()
    if (!publicUrl.startsWith('http')) {
      return NextResponse.json({ ok: false, error: '풀 저장 결과 URL이 올바르지 않습니다.' }, { status: 500 })
    }

    const storagePath = tryParseObjectKeyFromPublicUrl(publicUrl) ?? ''
    const bucket = getImageStorageBucket()
    const fileStem = stemFromPublicUrl(publicUrl, storagePath)
    const fileName = `${fileStem}.webp`
    const session = await auth()
    const uploadedBy =
      (session?.user as { email?: string | null })?.email?.trim() ||
      (session?.user as { name?: string | null })?.name?.trim() ||
      'admin'

    await clearPrimaryForEntity(ENTITY_TYPE, entityId)

    const id = randomUUID()
    const now = new Date().toISOString()
    const entityNameEn = entityId.toUpperCase()
    const altKr = `${entityNameKr} eSIM 추천 히어로`
    const altEn = `${entityNameEn} eSIM recommendation hero image`

    await insertImageAssetRow({
      id,
      entity_type: ENTITY_TYPE,
      entity_id: entityId,
      entity_name_kr: entityNameKr,
      entity_name_en: entityNameEn,
      supplier_name: null,
      service_type: SERVICE_TYPE,
      image_role: IMAGE_ROLE,
      is_primary: true,
      sort_order: 0,
      file_name: fileName,
      file_ext: 'webp',
      mime_type: 'image/webp',
      storage_bucket: bucket,
      storage_path: storagePath,
      public_url: publicUrl,
      alt_kr: altKr,
      alt_en: altEn,
      title_kr: null,
      title_en: null,
      seo_title_kr: null,
      seo_title_en: null,
      source_type: 'pexels',
      source_name: sourceTypeToSourceName('pexels'),
      source_note: sourceNote,
      is_generated: false,
      upload_status: 'completed',
      uploaded_by: uploadedBy,
      sheet_sync_status: 'skipped',
      sheet_sync_error: null,
      sheet_synced_at: null,
      uploaded_at: now,
      updated_at: now,
    })

    return NextResponse.json({ ok: true, publicUrl, id })
  } catch (e) {
    console.error('[api/admin/bongsim/country-heroes/[code]]', e)
    const msg = e instanceof Error ? e.message : '저장 실패'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
