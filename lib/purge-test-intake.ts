import { prisma } from '@/lib/prisma'
import { classifyTestIntake } from '@/lib/test-intake-policy'

export type TestIntakeCandidate =
  | {
      kind: 'inquiry'
      id: string
      accessionNumber: string
      customerName: string
      createdAt: string
      reasons: string[]
    }
  | {
      kind: 'booking'
      id: number
      accessionNumber: string
      customerName: string
      createdAt: string
      reasons: string[]
    }

export async function listTestIntakeCandidates(): Promise<TestIntakeCandidate[]> {
  const [inquiries, bookings] = await Promise.all([
    prisma.customerInquiry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        inquiryNumber: true,
        applicantName: true,
        applicantEmail: true,
        applicantPhone: true,
        message: true,
        createdAt: true,
      },
    }),
    prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        bookingNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        requestNotes: true,
        createdAt: true,
      },
    }),
  ])

  const out: TestIntakeCandidate[] = []

  for (const r of inquiries) {
    const c = classifyTestIntake({
      customerOrApplicantName: r.applicantName,
      email: r.applicantEmail,
      phone: r.applicantPhone,
      accessionNumber: r.inquiryNumber,
      message: r.message,
    })
    if (!c.isTest) continue
    out.push({
      kind: 'inquiry',
      id: r.id,
      accessionNumber: r.inquiryNumber,
      customerName: r.applicantName,
      createdAt: r.createdAt.toISOString(),
      reasons: c.reasons,
    })
  }

  for (const b of bookings) {
    const c = classifyTestIntake({
      customerOrApplicantName: b.customerName,
      email: b.customerEmail,
      phone: b.customerPhone,
      accessionNumber: b.bookingNumber,
      message: b.requestNotes,
    })
    if (!c.isTest) continue
    out.push({
      kind: 'booking',
      id: b.id,
      accessionNumber: b.bookingNumber,
      customerName: b.customerName,
      createdAt: b.createdAt.toISOString(),
      reasons: c.reasons,
    })
  }

  return out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function assertTestIntakeDeletable(
  kind: 'inquiry' | 'booking',
  id: string | number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (kind === 'inquiry') {
    const row = await prisma.customerInquiry.findUnique({
      where: { id: String(id) },
      select: {
        applicantName: true,
        applicantEmail: true,
        applicantPhone: true,
        inquiryNumber: true,
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
    if (!c.isTest) {
      return { ok: false, error: '테스트·E2E 접수만 삭제할 수 있습니다.' }
    }
    return { ok: true }
  }

  const bookingId = typeof id === 'number' ? id : parseInt(String(id), 10)
  if (Number.isNaN(bookingId)) return { ok: false, error: '잘못된 예약 id입니다.' }
  const row = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      bookingNumber: true,
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
  if (!c.isTest) {
    return { ok: false, error: '테스트·E2E 접수만 삭제할 수 있습니다.' }
  }
  return { ok: true }
}

export async function deleteTestIntake(
  kind: 'inquiry' | 'booking',
  id: string | number,
): Promise<void> {
  const gate = await assertTestIntakeDeletable(kind, id)
  if (!gate.ok) throw new Error(gate.error)

  if (kind === 'inquiry') {
    await prisma.customerInquiry.delete({ where: { id: String(id) } })
    return
  }

  const bookingId = typeof id === 'number' ? id : parseInt(String(id), 10)
  await prisma.booking.delete({ where: { id: bookingId } })
}

export async function purgeAllTestIntakes(dryRun: boolean): Promise<{
  dryRun: boolean
  candidates: TestIntakeCandidate[]
  deletedInquiries: number
  deletedBookings: number
}> {
  const candidates = await listTestIntakeCandidates()
  if (dryRun) {
    return {
      dryRun: true,
      candidates,
      deletedInquiries: 0,
      deletedBookings: 0,
    }
  }

  let deletedInquiries = 0
  let deletedBookings = 0
  for (const c of candidates) {
    if (c.kind === 'inquiry') {
      await prisma.customerInquiry.delete({ where: { id: c.id } })
      deletedInquiries += 1
    } else {
      await prisma.booking.delete({ where: { id: c.id } })
      deletedBookings += 1
    }
  }

  return { dryRun: false, candidates, deletedInquiries, deletedBookings }
}
