import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { imageAssetRowToApi } from '@/lib/image-asset-api-mapper'
import { requireAdmin } from '@/lib/require-admin'
import { runImageAssetUpload } from '@/lib/image-asset-upload-service'
import { prisma } from '@/lib/prisma'
import {
  productSupplierLabelForImageAsset,
  productTravelScopeToImageAssetServiceType,
} from '@/lib/admin-product-image-upload-resolve'

const MAX_BYTES = 30 * 1024 * 1024
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function hasAllowedExt(name: string): boolean {
  const lower = name.toLowerCase()
  return Array.from(ALLOWED_EXTENSIONS).some((ext) => lower.endsWith(ext))
}

function parseBool(v: FormDataEntryValue | null, defaultVal = false): boolean {
  if (v == null) return defaultVal
  const s = String(v).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'on' || s === 'yes'
}

function parseIntSafe(v: FormDataEntryValue | null, defaultVal = 0): number {
  if (v == null) return defaultVal
  const n = Number.parseInt(String(v), 10)
  return Number.isFinite(n) ? n : defaultVal
}

function parseAutoSourceHint(v: FormDataEntryValue | null): boolean {
  return parseBool(v, false)
}

/**
 * POST /api/admin/image-assets/upload
 * multipart: entity_type, entity_id, entity_name_kr, entity_name_en?, supplier_name?, service_type,
 * image_role, is_primary, sort_order, group_key?, file
 * 파일명·alt·public_url 은 전부 서버 SSOT.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ ok: false, error: '이미지 파일(file)이 필요합니다.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: '파일 크기는 30MB 이하여야 합니다.' }, { status: 400 })
    }
    const mime = (file.type || '').toLowerCase()
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      return NextResponse.json({ ok: false, error: 'jpg/png/webp MIME만 허용됩니다.' }, { status: 400 })
    }
    if (!hasAllowedExt(file.name || '')) {
      return NextResponse.json({ ok: false, error: '확장자는 .jpg/.jpeg/.png/.webp만 허용됩니다.' }, { status: 400 })
    }

    const session = await auth()
    const uploadedBy =
      (formData.get('uploaded_by') as string | null)?.trim() ||
      (session?.user as { email?: string | null })?.email?.trim() ||
      (session?.user as { name?: string | null })?.name?.trim() ||
      'admin'

    const buffer = Buffer.from(await file.arrayBuffer())

    const productContextId = String(formData.get('product_context_id') ?? '').trim()

    let entityType = String(formData.get('entity_type') ?? '')
    let entityId = String(formData.get('entity_id') ?? '').trim()
    let entityNameKr = String(formData.get('entity_name_kr') ?? '').trim()
    let entityNameEn = ((formData.get('entity_name_en') as string | null) ?? null)?.trim() || null
    let supplierName = ((formData.get('supplier_name') as string | null) ?? null)?.trim() || null
    let serviceType = String(formData.get('service_type') ?? '').trim()
    let imageRole = String(formData.get('image_role') ?? '').trim()
    let groupKey = ((formData.get('group_key') as string | null) ?? null)?.trim() || null
    let seoTitleKr = ((formData.get('seo_title_kr') as string | null) ?? null)?.trim() || null
    let seoTitleEn = ((formData.get('seo_title_en') as string | null) ?? null)?.trim() || null

    if (productContextId) {
      const p = await prisma.product.findUnique({
        where: { id: productContextId },
        select: {
          id: true,
          title: true,
          travelScope: true,
          originSource: true,
          brand: { select: { brandKey: true } },
        },
      })
      if (!p) {
        return NextResponse.json({ ok: false, error: '상품을 찾을 수 없습니다.' }, { status: 404 })
      }
      entityType = 'product'
      entityId = p.id
      entityNameKr = (p.title ?? '').trim() || '상품'
      supplierName = productSupplierLabelForImageAsset(p.originSource, p.brand?.brandKey ?? null)
      serviceType = productTravelScopeToImageAssetServiceType(p.travelScope)
      imageRole = imageRole || 'gallery'
      if (!seoTitleKr) seoTitleKr = entityNameKr
    } else if (!imageRole) {
      imageRole = 'hero'
    }

    const result = await runImageAssetUpload({
      entityType,
      entityId,
      entityNameKr,
      entityNameEn,
      supplierName,
      serviceType,
      imageRole,
      isPrimary: parseBool(formData.get('is_primary')),
      sortOrder: parseIntSafe(formData.get('sort_order'), 0),
      uploadedBy,
      groupKey,
      originalFileName: file.name || 'upload.bin',
      sourceType: (formData.get('source_type') as string | null) ?? null,
      sourceNote: (formData.get('source_note') as string | null) ?? null,
      isGeminiAuto: parseAutoSourceHint(formData.get('is_gemini_auto')),
      isPexelsAuto: parseAutoSourceHint(formData.get('is_pexels_auto')),
      titleKr: (formData.get('title_kr') as string | null) ?? null,
      titleEn: (formData.get('title_en') as string | null) ?? null,
      seoTitleKr,
      seoTitleEn,
      fileBuffer: buffer,
      originalMime: mime,
    })

    return NextResponse.json({
      ok: true,
      asset: imageAssetRowToApi(result.asset),
    })
  } catch (e) {
    console.error('[image-assets/upload]', e)
    const msg = e instanceof Error ? e.message : '업로드 실패'
    if (msg.startsWith('Invalid source_type')) {
      return NextResponse.json({ ok: false, error: 'validation_error', message: msg }, { status: 400 })
    }
    // 관리자 전용: Supabase Storage·WebP·DB 등 실패 원인을 UI에 표시 (page는 message ?? error)
    const status =
      (msg.includes('Supabase') ||
        msg.includes('Storage') ||
        /AccessDenied|SignatureDoesNotMatch|ECONNREFUSED|ENOTFOUND|timeout/i.test(msg))
        ? 503
        : 400
    return NextResponse.json({ ok: false, error: '업로드 실패', message: msg }, { status })
  }
}
