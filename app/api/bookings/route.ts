import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeKRWQuotation, computeLocalFeeTotal, type PriceRowLike } from '@/lib/price-utils'
import { sendAdminNotificationWithPayload } from '@/lib/notification-service'
import { assertNoInternalMetaLeak } from '@/lib/public-response-guard'
import {
  buildCustomerBookingReceiptMessage,
  validateBookingIntake,
} from '@/lib/booking-intake-contract'
import { buildAdminBookingAlertPayload } from '@/lib/booking-alert-payload'
import { getRateLimitStore } from '@/lib/rate-limit-store'
import { getPublicMutationOriginError, publicMutationOriginJsonResponse } from '@/lib/public-mutation-origin'

const BOOKING_RATE_LIMIT_WINDOW_MS = 60_000
const BOOKING_RATE_LIMIT_MAX = 10

function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return headers.get('x-real-ip') || 'unknown'
}

/**
 * POST /api/bookings
 * - 입력: BookingIntakeDto (lib/booking-intake-contract.ts)
 * - 선택 출발일이 있으면 해당 일자 가격으로 견적 산정(schedule_price)
 * - 희망 출발일만 있으면 접수만 하고 견적 0·wish_date_only (운영자가 이후 확정)
 */
export async function POST(request: Request) {
  try {
    const originErr = getPublicMutationOriginError(request)
    if (originErr) return publicMutationOriginJsonResponse(originErr)

    const ip = getClientIp(request.headers)
    const store = getRateLimitStore()
    const bucket = await store.incr(`public:bookings:${ip}`, BOOKING_RATE_LIMIT_WINDOW_MS)
    if (bucket.count > BOOKING_RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000))) } }
      )
    }

    const body = await request.json()
    const honeypot = typeof body?.website === 'string' ? body.website.trim() : ''
    if (honeypot) {
      return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
    }
    const rawProductId = String(body.productId ?? '').trim()

    const selectedDepartureDate =
      typeof body.selectedDepartureDate === 'string'
        ? body.selectedDepartureDate.trim().slice(0, 10) || null
        : typeof body.selectedDate === 'string'
          ? body.selectedDate.trim().slice(0, 10) || null
          : null
    const preferredDepartureDate =
      typeof body.preferredDepartureDate === 'string'
        ? body.preferredDepartureDate.trim().slice(0, 10) || null
        : null

    const product = await prisma.product.findFirst({
      where: { id: rawProductId, registrationStatus: 'registered' },
      include: { prices: { orderBy: { date: 'asc' } } },
    })
    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    const intakeCandidate = {
      productId: rawProductId,
      originSource:
        typeof body.originSource === 'string' ? body.originSource.trim() : (product.originSource ?? ''),
      originCode: typeof body.originCode === 'string' ? body.originCode.trim() : (product.originCode ?? ''),
      selectedDepartureDate,
      preferredDepartureDate,
      departureId:
        body.departureId != null && String(body.departureId).trim()
          ? String(body.departureId).trim()
          : body.sourceRowId != null && String(body.sourceRowId).trim()
            ? String(body.sourceRowId).trim()
            : null,
      customerName: typeof body.customerName === 'string' ? body.customerName.trim() : '',
      customerPhone: typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '',
      customerEmail: typeof body.customerEmail === 'string' ? body.customerEmail.trim() : '',
      totalPax: body.totalPax,
      adultCount: Math.max(0, parseInt(String(body.adultCount ?? body.adult ?? 0), 10) || 0),
      childCount: Math.max(0, parseInt(String(body.childCount ?? 0), 10) || 0),
      childWithBedCount: Math.max(
        0,
        parseInt(String(body.childBedCount ?? body.childWithBedCount ?? 0), 10) || 0
      ),
      childNoBedCount: Math.max(0, parseInt(String(body.childNoBedCount ?? 0), 10) || 0),
      infantCount: Math.max(0, parseInt(String(body.infantCount ?? body.infant ?? 0), 10) || 0),
      singleRoomRequested: Boolean(body.singleRoomRequested),
      preferredContactChannel:
        typeof body.preferredContactChannel === 'string' ? body.preferredContactChannel : 'phone',
      childInfantBirthDates: Array.isArray(body.childInfantBirthDates) ? body.childInfantBirthDates : [],
      requestNotes: typeof body.requestNotes === 'string' ? body.requestNotes.trim() : null,
    }

    if (!intakeCandidate.childCount) {
      intakeCandidate.childCount = intakeCandidate.childWithBedCount + intakeCandidate.childNoBedCount
    }

    const validated = validateBookingIntake(intakeCandidate)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.errors.join(' ') }, { status: 400 })
    }
    const intake = validated.value

    const pax = {
      adult: intake.adultCount,
      childBed: intake.childWithBedCount,
      childNoBed: intake.childNoBedCount,
      infant: intake.infantCount,
    }

    const hasSelected = Boolean(intake.selectedDepartureDate)
    const primaryDate = intake.selectedDepartureDate ?? intake.preferredDepartureDate
    if (!primaryDate) {
      return NextResponse.json({ error: '출발일 정보가 없습니다.' }, { status: 400 })
    }
    const dateKey = primaryDate.slice(0, 10)

    let totalKrwAmount = 0
    let totalLocalAmount = 0
    const localCurrency = product.mandatoryCurrency ?? 'USD'

    let pricingMode: 'schedule_price' | 'wish_date_only' | 'schedule_selected_pending_quote'
    if (hasSelected) {
      const priceRow = product.prices.find((p) => {
        const raw = p.date
        const d =
          raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).slice(0, 10)
        return d === dateKey
      })
      if (!priceRow) {
        pricingMode = 'schedule_selected_pending_quote'
        totalKrwAmount = 0
        totalLocalAmount = 0
      } else {
        pricingMode = 'schedule_price'
        const paxForKrw = {
          adult: pax.adult,
          childBed: pax.childBed,
          childNoBed: pax.childNoBed,
          infant: pax.infant,
        }
        const { total } = computeKRWQuotation(priceRow as PriceRowLike, paxForKrw)
        totalKrwAmount = total
        totalLocalAmount = computeLocalFeeTotal(product.mandatoryLocalFee, {
          adult: pax.adult,
          childBed: pax.childBed,
          childNoBed: pax.childNoBed,
        }) ?? 0
      }
    } else {
      pricingMode = 'wish_date_only'
    }

    const birthsJson = JSON.stringify(
      intake.childInfantBirthDates.map((x) => ({ type: x.type, birthDate: x.birthDate }))
    )

    const preferredExtra =
      intake.selectedDepartureDate && intake.preferredDepartureDate
        ? new Date(intake.preferredDepartureDate + 'T00:00:00.000Z')
        : null

    const booking = await prisma.booking.create({
      data: {
        productId: product.id,
        productTitle: product.title,
        selectedDate: new Date(dateKey + 'T00:00:00.000Z'),
        preferredDepartureDate: preferredExtra,
        pricingMode,
        adultCount: pax.adult,
        childBedCount: pax.childBed,
        childNoBedCount: pax.childNoBed,
        infantCount: pax.infant,
        totalKrwAmount,
        totalLocalAmount,
        localCurrency,
        customerName: intake.customerName,
        customerPhone: intake.customerPhone,
        customerEmail: intake.customerEmail.trim() ? intake.customerEmail.trim() : null,
        requestNotes: intake.requestNotes ?? null,
        preferredContactChannel: intake.preferredContactChannel,
        singleRoomRequested: intake.singleRoomRequested,
        childInfantBirthDatesJson: birthsJson,
        originSourceSnapshot: intake.originSource,
        originCodeSnapshot: intake.originCode,
        status: '접수완료',
      },
      include: { product: true },
    })

    const adminPayload = buildAdminBookingAlertPayload(intake, {
      productTitle: booking.productTitle,
      adminLinkBase: process.env.NEXT_PUBLIC_APP_URL || process.env.BONGTOUR_API_BASE || '',
    })
    void sendAdminNotificationWithPayload(booking, adminPayload)
      .then((r) => {
        if (!r.ok) console.error('[sendAdminNotification] 실패:', r.code ?? r.message)
      })
      .catch(() => console.error('[sendAdminNotification] 예외'))

    const payload = {
      ok: true,
      bookingId: booking.id,
      message: buildCustomerBookingReceiptMessage(intake.customerName),
      pricingMode,
    }
    assertNoInternalMetaLeak(payload, '/api/bookings')
    return NextResponse.json(payload)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
