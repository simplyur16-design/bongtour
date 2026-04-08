import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { maskEmail, maskPhone } from '@/lib/pii'
import {
  assertBookingStatusTransition,
  BOOKING_STATUSES,
  isBookingStatus,
} from '@/lib/booking-status-policy'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/admin/bookings/[id]. 인증: 관리자.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const isSuper = admin.user.role === 'SUPER_ADMIN'
    const { id } = await params
    const bookingId = parseInt(id, 10)
    if (Number.isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        product: true,
      },
    })
    if (!booking) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({
      ...booking,
      customerPhone: isSuper ? booking.customerPhone : maskPhone(booking.customerPhone),
      customerEmail: booking.customerEmail ? (isSuper ? booking.customerEmail : maskEmail(booking.customerEmail)) : null,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/bookings/[id]. 인증: 관리자.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id } = await params
    const bookingId = parseInt(id, 10)
    if (Number.isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const body = await request.json()
    const status = typeof body.status === 'string' ? body.status.trim() : ''
    if (!isBookingStatus(status)) {
      return NextResponse.json(
        { error: `status는 ${BOOKING_STATUSES.join(', ')} 중 하나여야 합니다.` },
        { status: 400 }
      )
    }
    const existing = await prisma.booking.findUnique({ where: { id: bookingId } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const transition = assertBookingStatusTransition(existing.status, status)
    if (!transition.ok) {
      return NextResponse.json({ error: transition.error }, { status: 400 })
    }
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
    })
    return NextResponse.json(booking)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
