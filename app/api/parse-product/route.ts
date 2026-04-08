import { NextResponse } from 'next/server'
import { extractProductFromText, extractPricingScheduleFromText } from '@/lib/gemini'
import { mapToParsedProductForDB } from '@/lib/map-to-parsed-product'
import { requireAdmin } from '@/lib/require-admin'

/**
 * POST /api/parse-product
 * Raw 텍스트 + 여행사(originSource) → 상품정보·가격·일정 파싱 후 새 DB용 DTO 반환.
 * [Parsing Rules] 적용: 성인/아동/노베드/유아 분리, 기본가+유류=최종가, 인원별 할증, 현지 가이드비·싱글룸
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const body = await request.json()
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    const originSource = typeof body.originSource === 'string' ? body.originSource.trim() : '직접입력'
    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const [productResult, pricingResult] = await Promise.allSettled([
      extractProductFromText(text),
      extractPricingScheduleFromText(text),
    ])
    const product = productResult.status === 'fulfilled' ? productResult.value : null
    const pricing =
      pricingResult.status === 'fulfilled' && pricingResult.value?.daily_schedule?.length
        ? pricingResult.value
        : null

    if (!product) {
      throw productResult.status === 'rejected' ? productResult.reason : new Error('AI 파싱 실패')
    }

    const parsed = mapToParsedProductForDB(product, pricing, originSource)
    return NextResponse.json({
      product,
      pricing,
      parsed,
    })
  } catch (e) {
    console.error(e)
    const showDetail = process.env.NODE_ENV === 'development'
    const msg =
      showDetail && e instanceof Error
        ? e.message
        : '파싱 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
