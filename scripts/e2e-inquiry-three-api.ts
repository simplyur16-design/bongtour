/**
 * 로컬 dev에서 POST /api/inquiries 3건(여행상품·버스·통역) + DB 확인.
 * 전제: npm run dev → http://localhost:3000
 * 실행: npx tsx scripts/e2e-inquiry-three-api.ts
 *
 * 운영 최종 검수 아님 — `npm run verify:inquiry:live` 와 목적이 다름(API·DB 스모크).
 */
import './load-env-for-scripts'
import { PrismaClient } from '@prisma/client'

const BASE = 'http://localhost:3000'

async function post(body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${BASE}/api/inquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, json }
}

function privacy(): string {
  return new Date().toISOString()
}

async function main(): Promise<void> {
  const prisma = new PrismaClient()
  let productId: string | null = null
  let snapTitle: string | null = null
  try {
    const p = await prisma.product.findFirst({
      where: { registrationStatus: 'registered' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, originCode: true },
    })
    if (p) {
      productId = p.id
      snapTitle = (p.title ?? '').slice(0, 200)
    }
  } finally {
    await prisma.$disconnect()
  }

  const tag = `e2e3-${Date.now()}`
  const results: Array<{ label: string; status: number; json: Record<string, unknown> }> = []

  const travelBody = {
    inquiryType: 'travel_consult',
    applicantName: `${tag}-travel`,
    applicantPhone: '010-8888-9999',
    applicantEmail: 'e2e-travel@test.local',
    message: 'E2E 여행상품 문의 본문입니다.',
    website: '',
    privacyAgreed: true,
    privacyNoticeConfirmedAt: privacy(),
    privacyNoticeVersion: 'training-inquiry-v1',
    preferredContactChannel: 'kakao',
    productId,
    snapshotProductTitle: snapTitle,
    payloadJson: {
      adultCount: 2,
      childCount: 1,
      infantCount: 0,
      targetYearMonth: '2026-05',
    },
  }

  const busBody = {
    inquiryType: 'bus_quote',
    applicantName: `${tag}-bus`,
    applicantPhone: '010-7777-6666',
    applicantEmail: 'e2e-bus@test.local',
    message: 'E2E 전세버스 문의 본문입니다. 최소 길이를 채웁니다. 전세버스.',
    website: '',
    privacyAgreed: true,
    privacyNoticeConfirmedAt: privacy(),
    privacyNoticeVersion: 'charter-bus-inquiry-v1',
    preferredContactChannel: 'email',
    payloadJson: {
      consultType: 'CHARTER_BUS',
      quoteKind: 'charter_bus_consult',
      usageType: '관광/자유 일정 이동',
      useDate: '2026-06-15',
      departurePlace: '서울',
      arrivalPlace: '부산',
      estimatedHeadcount: 25,
      tripType: 'round_trip',
      waitingRequired: false,
      luggageRequired: false,
    },
  }

  const interpBody = {
    inquiryType: 'institution_request',
    applicantName: `${tag}-interp`,
    applicantPhone: '010-5555-4444',
    applicantEmail: 'e2e-interp@test.local',
    message: 'E2E 통역 기관 문의 본문입니다.',
    website: '',
    privacyAgreed: true,
    privacyNoticeConfirmedAt: privacy(),
    privacyNoticeVersion: 'training-inquiry-v1',
    preferredContactChannel: 'kakao',
    payloadJson: {
      interpreterNeeded: true,
      preferredCountryCity: '도쿄',
      organizationName: 'E2E테스트학교',
      estimatedHeadcount: 6,
    },
  }

  results.push({ label: 'travel', ...(await post(travelBody)) })
  results.push({ label: 'bus', ...(await post(busBody)) })
  results.push({ label: 'interp', ...(await post(interpBody)) })

  const prisma2 = new PrismaClient()
  try {
    const rows = await prisma2.customerInquiry.findMany({
      where: { applicantName: { startsWith: tag } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        inquiryType: true,
        applicantName: true,
        productId: true,
        snapshotProductTitle: true,
        payloadJson: true,
        emailSentStatus: true,
        emailError: true,
      },
    })
    console.log(JSON.stringify({ productIdUsed: productId, results, dbRows: rows }, null, 2))
    const bad = rows.filter((r) => r.inquiryType === 'travel_consult' && r.productId && !r.snapshotProductTitle)
    if (bad.length) console.error('unexpected rows', bad)
  } finally {
    await prisma2.$disconnect()
  }

  const failed = results.filter((r) => r.status !== 200 || r.json.ok === false)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
