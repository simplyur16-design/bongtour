import { extractProductFromText, extractPricingScheduleFromText } from '@/lib/gemini'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { requireAdmin } from '@/lib/require-admin'

/**
 * POST /api/extract
 * 본사 상세페이지 텍스트를 받아 상품정보(B2B) + 가격캘린더(연령별·날짜별) 동시 추출.
 * 응답: { product: ExtractedProduct, pricing: ExtractedPricingSchedule | null }
 * pricing 추출 실패 시 product만 반환하고 pricing은 null.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return jsonWithLeakGuard({ error: '인증이 필요합니다.' }, 'api.extract.auth', { status: 401 })
  try {
    const body = await request.json()
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) {
      return jsonWithLeakGuard({ error: 'text is required' }, 'api.extract.validation', { status: 400 })
    }
    const [product, pricingResult] = await Promise.allSettled([
      extractProductFromText(text),
      extractPricingScheduleFromText(text),
    ])
    const extractedProduct =
      product.status === 'fulfilled' ? product.value : null
    const pricing =
      pricingResult.status === 'fulfilled' && pricingResult.value?.daily_schedule?.length
        ? pricingResult.value
        : null
    if (!extractedProduct) {
      throw product.status === 'rejected' ? product.reason : new Error('AI 분석 실패')
    }
    return jsonWithLeakGuard({ product: extractedProduct, pricing }, 'api.extract.ok')
  } catch (e) {
    console.error(e)
    return jsonWithLeakGuard({ error: 'AI 분석 실패' }, 'api.extract.catch', { status: 500 })
  }
}
