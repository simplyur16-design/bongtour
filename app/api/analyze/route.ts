import { extractProductFromText } from '@/lib/gemini'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { requireAdmin } from '@/lib/require-admin'

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return jsonWithLeakGuard({ error: '인증이 필요합니다.' }, 'api.analyze.auth', { status: 401 })
  try {
    const body = await request.json()
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) {
      return jsonWithLeakGuard({ error: 'text is required' }, 'api.analyze.validation', { status: 400 })
    }
    const extracted = await extractProductFromText(text)
    return jsonWithLeakGuard(extracted, 'api.analyze.ok')
  } catch (e) {
    console.error(e)
    return jsonWithLeakGuard({ error: 'Analysis failed' }, 'api.analyze.catch', { status: 500 })
  }
}
