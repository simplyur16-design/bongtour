import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminToolApi } from '@/lib/require-admin-tool'
import {
  parseOptionalInquiryStatus,
  parseStaffReplyChannel,
  sendStaffInquiryReply,
} from '@/lib/admin-inquiry-staff-reply'
import { INQUIRY_ADMIN_STATUSES } from '@/lib/admin-inquiry'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/admin/quick-actions/inquiries/[id]/respond
 * Body: { replyText, channel: email|sms|alimtalk, status? }
 */
export async function POST(request: Request, ctx: Ctx) {
  const gate = await requireAdminToolApi()
  if (gate instanceof NextResponse) return gate

  const { id } = await ctx.params
  if (!id?.trim()) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }

  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: '본문 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const o = body as Record<string, unknown>
  const replyText = typeof o.replyText === 'string' ? o.replyText : ''
  const channel = parseStaffReplyChannel(o.channel)
  if (!channel) {
    return NextResponse.json({ error: 'channel은 email, sms, alimtalk 중 하나여야 합니다.' }, { status: 400 })
  }

  const statusNext = parseOptionalInquiryStatus(o.status)
  if (o.status != null && o.status !== '' && !statusNext) {
    return NextResponse.json(
      { error: '유효하지 않은 status입니다.', allowed: [...INQUIRY_ADMIN_STATUSES] },
      { status: 400 },
    )
  }

  const row = await prisma.customerInquiry.findUnique({
    where: { id },
    select: {
      id: true,
      inquiryNumber: true,
      applicantName: true,
      applicantPhone: true,
      applicantEmail: true,
      status: true,
    },
  })
  if (!row) {
    return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 })
  }

  const sendResult = await sendStaffInquiryReply({
    inquiryNumber: row.inquiryNumber,
    applicantName: row.applicantName,
    applicantPhone: row.applicantPhone,
    applicantEmail: row.applicantEmail,
    replyText,
    channel,
  })

  if (!sendResult.ok) {
    return NextResponse.json({ ok: false, error: sendResult.error, channel }, { status: 502 })
  }

  const data: { status?: string } = {}
  if (statusNext) data.status = statusNext
  else if (row.status === 'received') data.status = 'contacted'

  const updated = await prisma.customerInquiry.update({
    where: { id },
    data,
    select: { id: true, status: true, updatedAt: true },
  })

  return NextResponse.json({
    ok: true,
    channel: sendResult.channel,
    detail: sendResult.detail ?? null,
    inquiry: {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    },
  })
}
