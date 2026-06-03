import { prisma } from '@/lib/prisma'
import { classifyTestIntake } from '@/lib/test-intake-policy'

export type IntakeDeleteKind = 'inquiry' | 'booking'

export type IntakeDeleteRef = {
  kind: IntakeDeleteKind
  id: string | number
}

export type IntakeDeleteTarget = IntakeDeleteRef & {
  isTest: boolean
  accessionNumber: string
}

async function resolveIntakeDeleteTarget(
  kind: IntakeDeleteKind,
  id: string | number,
): Promise<{ ok: true; target: IntakeDeleteTarget } | { ok: false; error: string }> {
  if (kind === 'inquiry') {
    const row = await prisma.customerInquiry.findUnique({
      where: { id: String(id) },
      select: {
        id: true,
        inquiryNumber: true,
        applicantName: true,
        applicantEmail: true,
        applicantPhone: true,
        message: true,
      },
    })
    if (!row) return { ok: false, error: '문의를 찾을 수 없습니다.' }
    const c = classifyTestIntake({
      customerOrApplicantName: row.applicantName,
      email: row.applicantEmail,
      phone: row.applicantPhone,
      accessionNumber: row.inquiryNumber,
      message: row.message,
    })
    return {
      ok: true,
      target: {
        kind: 'inquiry',
        id: row.id,
        isTest: c.isTest,
        accessionNumber: row.inquiryNumber,
      },
    }
  }

  const bookingId = typeof id === 'number' ? id : parseInt(String(id), 10)
  if (Number.isNaN(bookingId)) return { ok: false, error: '잘못된 예약 id입니다.' }
  const row = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      bookingNumber: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      requestNotes: true,
    },
  })
  if (!row) return { ok: false, error: '예약을 찾을 수 없습니다.' }
  const c = classifyTestIntake({
    customerOrApplicantName: row.customerName,
    email: row.customerEmail,
    phone: row.customerPhone,
    accessionNumber: row.bookingNumber,
    message: row.requestNotes,
  })
  return {
    ok: true,
    target: {
      kind: 'booking',
      id: row.id,
      isTest: c.isTest,
      accessionNumber: row.bookingNumber,
    },
  }
}

/** 관리자(ADMIN) — 테스트 여부와 관계없이 단건 삭제 */
export async function deleteAdminIntake(kind: IntakeDeleteKind, id: string | number): Promise<void> {
  const resolved = await resolveIntakeDeleteTarget(kind, id)
  if (!resolved.ok) throw new Error(resolved.error)

  if (resolved.target.kind === 'inquiry') {
    await prisma.customerInquiry.delete({ where: { id: String(resolved.target.id) } })
    return
  }

  const bookingId =
    typeof resolved.target.id === 'number'
      ? resolved.target.id
      : parseInt(String(resolved.target.id), 10)
  await prisma.booking.delete({ where: { id: bookingId } })
}

export async function deleteAdminIntakesBatch(
  items: IntakeDeleteRef[],
): Promise<{
  deleted: IntakeDeleteRef[]
  failed: { kind: IntakeDeleteKind; id: string | number; error: string }[]
}> {
  const deleted: IntakeDeleteRef[] = []
  const failed: { kind: IntakeDeleteKind; id: string | number; error: string }[] = []

  for (const item of items) {
    try {
      await deleteAdminIntake(item.kind, item.id)
      deleted.push(item)
    } catch (e) {
      failed.push({
        kind: item.kind,
        id: item.id,
        error: e instanceof Error ? e.message : '삭제에 실패했습니다.',
      })
    }
  }

  return { deleted, failed }
}
