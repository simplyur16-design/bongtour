import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { pickTalktalkCompareCandidates } from '@/lib/talktalk-draft/compare-candidates'
import { buildTalktalkDraft } from '@/lib/talktalk-draft/draft'
import { ADMIN_DRAFT_FAQ, TALKTALK_FAQ_NEEDS_ANSWER, faqCountByCategory } from '@/lib/talktalk-draft/faq'
import { loadTalktalkCompareProducts } from '@/lib/talktalk-draft/load-compare-pool'
import { loadStoredSingleRoomByProductCode } from '@/lib/talktalk-draft/load-single-room'
import { parseTalktalkInquiryText } from '@/lib/talktalk-draft/parse-inquiry'
import { singleRoomAmountLabelFromStored } from '@/lib/talktalk-draft/single-room-amount'
import { resolveComparePlaceCluster } from '@/lib/similar-itinerary-compare-cluster'

export const dynamic = 'force-dynamic'

type Body = {
  inquiryText?: unknown
  destination?: unknown
  departureDate?: unknown
  budgetKrw?: unknown
  partySize?: unknown
  duration?: unknown
  productCode?: unknown
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * 관리자 답변 초안. 화면 표시용 JSON만 돌려준다.
 * REGRESSION-FREEZE[talktalk-draft-no-send-no-price-invent]: 발송 호출 없음 — manifest
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: '본문을 읽지 못했습니다.' }, { status: 400 })
  }

  const inquiryText = str(body.inquiryText)
  if (!inquiryText) {
    return NextResponse.json({ error: '문의 내용을 붙여 넣어 주세요.' }, { status: 400 })
  }

  const parsed = parseTalktalkInquiryText(inquiryText)
  const destination =
    str(body.destination) ||
    parsed.destination ||
    resolveComparePlaceCluster({ placeQuery: inquiryText })?.label ||
    ''
  const departureDate = str(body.departureDate) || parsed.departureDate
  const duration = str(body.duration) || parsed.duration
  const budgetKrw = num(body.budgetKrw) ?? parsed.budgetKrw
  const partySize = num(body.partySize) ?? parsed.partySize

  if (!destination) {
    return NextResponse.json({ error: '목적지를 메가메뉴 도시로 읽지 못했습니다. 목적지 칸을 채워 주세요.' }, { status: 400 })
  }

  const products = await loadTalktalkCompareProducts({ destination })
  const picked = pickTalktalkCompareCandidates({
    destination,
    departureDate,
    budgetKrw,
    partySize,
    duration,
    products,
  })
  const asksSingleRoom = /1인실|싱글룸|싱글\s*차지|싱글차지/.test(inquiryText)
  const productCode = str(body.productCode)
  const storedSingle = asksSingleRoom && productCode ? await loadStoredSingleRoomByProductCode(productCode) : null
  const singleRoomLabel = asksSingleRoom ? singleRoomAmountLabelFromStored(storedSingle) : null
  const draft = buildTalktalkDraft({
    inquiryText,
    placeLabel: picked.placeLabel,
    weekStartYmd: picked.weekStartYmd,
    weekFellBack: picked.weekFellBack,
    durationNote: !duration,
    candidates: picked.candidates,
    singleRoomLabel,
  })

  return NextResponse.json({
    sent: false,
    parsed: { destination, departureDate, budgetKrw, partySize, duration, category: parsed.category },
    placeLabel: picked.placeLabel,
    weekStartYmd: picked.weekStartYmd,
    weekFellBack: picked.weekFellBack,
    candidates: picked.candidates,
    faq: draft.faq,
    faqCatalog: ADMIN_DRAFT_FAQ,
    faqCount: faqCountByCategory(),
    needsAnswer: TALKTALK_FAQ_NEEDS_ANSWER,
    draftText: draft.text,
  })
}
