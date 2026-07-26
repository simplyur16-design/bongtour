/**
 * eSIM 소속 명함 요청 — 업로드·OCR·관리자 승인.
 * REGRESSION-FREEZE[bongsim-affiliation-card-ocr]: affiliation card service — manifest
 */
import { prisma } from '@/lib/prisma'
import { isObjectStorageConfigured, uploadStorageObject } from '@/lib/object-storage'
import { sendAdminShortAlertSms } from '@/lib/notification-service'
import {
  invokeClovaNameCardOcr,
  isClovaNameCardOcrConfigured,
  type ClovaNameCardOcrFields,
} from '@/lib/bongsim/affiliation/clova-name-card-ocr'

export type AffiliationCardStatus = 'pending' | 'approved' | 'rejected'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

function extFromMime(mime: string): 'jpg' | 'jpeg' | 'png' | 'webp' {
  const m = mime.toLowerCase()
  if (m.includes('png')) return 'png'
  if (m.includes('webp')) return 'webp'
  return 'jpg'
}

export async function getLatestAffiliationCardForUser(userId: string) {
  return prisma.bongsimAffiliationCardRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function listAffiliationCardRequests(params?: {
  status?: AffiliationCardStatus | 'all'
  take?: number
}) {
  const status = params?.status && params.status !== 'all' ? params.status : undefined
  return prisma.bongsimAffiliationCardRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(params?.take ?? 50, 1), 200),
  })
}

export type SubmitAffiliationCardResult =
  | {
      ok: true
      requestId: string
      status: 'pending'
      fields: ClovaNameCardOcrFields
      ocrOk: boolean
      imageUrl: string
    }
  | {
      ok: false
      reason:
        | 'storage_unconfigured'
        | 'invalid_image'
        | 'already_verified'
        | 'pending_exists'
        | 'upload_failed'
        | 'db_error'
      message: string
    }

export async function submitAffiliationCardRequest(params: {
  userId: string
  fileBuffer: Buffer
  contentType: string
  fileName?: string | null
}): Promise<SubmitAffiliationCardResult> {
  const userId = params.userId.trim()
  if (!userId) {
    return { ok: false, reason: 'db_error', message: 'userId 필요' }
  }
  if (!isObjectStorageConfigured()) {
    return { ok: false, reason: 'storage_unconfigured', message: '이미지 저장소가 설정되지 않았습니다.' }
  }

  const mime = (params.contentType || '').split(';')[0]?.trim().toLowerCase() || ''
  if (!ALLOWED_MIME.has(mime) && !mime.startsWith('image/')) {
    return { ok: false, reason: 'invalid_image', message: '이미지 파일만 업로드할 수 있습니다.' }
  }
  if (params.fileBuffer.length <= 0 || params.fileBuffer.length > MAX_BYTES) {
    return { ok: false, reason: 'invalid_image', message: '이미지 크기는 8MB 이하여야 합니다.' }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      affiliationVerified: true,
      name: true,
      email: true,
    },
  })
  if (!user) {
    return { ok: false, reason: 'db_error', message: '회원을 찾을 수 없습니다.' }
  }
  if (user.affiliationVerified) {
    return { ok: false, reason: 'already_verified', message: '이미 eSIM 직군 할인이 적용된 계정입니다.' }
  }

  const pending = await prisma.bongsimAffiliationCardRequest.findFirst({
    where: { userId, status: 'pending' },
    select: { id: true },
  })
  if (pending) {
    return {
      ok: false,
      reason: 'pending_exists',
      message: '이미 검토 중인 명함이 있습니다. 관리자 승인 후 다시 시도해 주세요.',
    }
  }

  const stamp = Date.now()
  const ext = extFromMime(mime)
  const objectKey = `affiliation-cards/${userId}/${stamp}.${ext === 'jpeg' ? 'jpg' : ext}`

  let uploaded: { objectKey: string; publicUrl: string }
  try {
    uploaded = await uploadStorageObject({
      objectKey,
      body: params.fileBuffer,
      contentType: mime || `image/${ext}`,
    })
  } catch (e) {
    return {
      ok: false,
      reason: 'upload_failed',
      message: e instanceof Error ? e.message : '이미지 업로드 실패',
    }
  }

  let fields: ClovaNameCardOcrFields = {
    name: null,
    company: null,
    email: null,
    phone: null,
    position: null,
  }
  let ocrRawJson: string | null = null
  let ocrOk = false

  if (isClovaNameCardOcrConfigured()) {
    const ocr = await invokeClovaNameCardOcr({
      imageBase64: params.fileBuffer.toString('base64'),
      format: ext,
      requestId: `affil-${userId.slice(0, 8)}-${stamp}`,
    })
    if (ocr.ok) {
      fields = ocr.fields
      ocrRawJson = JSON.stringify(ocr.raw).slice(0, 200_000)
      ocrOk = true
    } else {
      ocrRawJson = JSON.stringify({ error: ocr.reason, message: ocr.message, raw: ocr.raw }).slice(0, 20_000)
    }
  }

  try {
    const row = await prisma.bongsimAffiliationCardRequest.create({
      data: {
        userId,
        status: 'pending',
        imageObjectKey: uploaded.objectKey,
        imageUrl: uploaded.publicUrl,
        ocrRawJson,
        ocrName: fields.name,
        ocrCompany: fields.company,
        ocrEmail: fields.email,
        ocrPhone: fields.phone,
        ocrPosition: fields.position,
      },
    })

    const who = (user.name || user.email || userId).slice(0, 40)
    const company = (fields.company || '-').slice(0, 40)
    void sendAdminShortAlertSms(
      `[봉투어] 명함 승인요청\n${who}\n회사:${company}\n/admin/bongsim/affiliation-cards`,
      { channel: 'affiliation_card' },
    ).catch((e) => console.warn('[affiliation-card] admin sms', e))

    return {
      ok: true,
      requestId: row.id,
      status: 'pending',
      fields,
      ocrOk,
      imageUrl: uploaded.publicUrl,
    }
  } catch (e) {
    return {
      ok: false,
      reason: 'db_error',
      message: e instanceof Error ? e.message : '요청 저장 실패',
    }
  }
}

export type ReviewAffiliationCardResult =
  | { ok: true; status: 'approved' | 'rejected' }
  | { ok: false; reason: 'not_found' | 'not_pending' | 'db_error'; message: string }

export async function reviewAffiliationCardRequest(params: {
  requestId: string
  decision: 'approve' | 'reject'
  adminUserId: string
  adminNote?: string | null
}): Promise<ReviewAffiliationCardResult> {
  const id = params.requestId.trim()
  const row = await prisma.bongsimAffiliationCardRequest.findUnique({ where: { id } })
  if (!row) return { ok: false, reason: 'not_found', message: '요청을 찾을 수 없습니다.' }
  if (row.status !== 'pending') {
    return { ok: false, reason: 'not_pending', message: '이미 처리된 요청입니다.' }
  }

  const now = new Date()
  const note = (params.adminNote ?? '').trim().slice(0, 2000) || null

  try {
    if (params.decision === 'reject') {
      await prisma.bongsimAffiliationCardRequest.update({
        where: { id },
        data: {
          status: 'rejected',
          adminNote: note,
          reviewedBy: params.adminUserId,
          reviewedAt: now,
        },
      })
      return { ok: true, status: 'rejected' }
    }

    await prisma.$transaction([
      prisma.bongsimAffiliationCardRequest.update({
        where: { id },
        data: {
          status: 'approved',
          adminNote: note,
          reviewedBy: params.adminUserId,
          reviewedAt: now,
        },
      }),
      prisma.user.update({
        where: { id: row.userId },
        data: {
          affiliationVerified: true,
          affiliationVerifiedAt: now,
          affiliationOrgName: row.ocrCompany?.trim() || null,
          affiliationCardImageUrl: row.imageUrl,
        },
      }),
    ])
    return { ok: true, status: 'approved' }
  } catch (e) {
    return {
      ok: false,
      reason: 'db_error',
      message: e instanceof Error ? e.message : '승인 처리 실패',
    }
  }
}
