import { NextResponse } from 'next/server'
import { extractProductFromText } from '@/lib/gemini'
import { requireAdmin } from '@/lib/require-admin'

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const body = await request.json()
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    const extracted = await extractProductFromText(text)
    return NextResponse.json(extracted)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}
