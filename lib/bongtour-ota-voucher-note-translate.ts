/**
 * 관리자 비고(한글) → 영문 바우처 Notes 번역.
 * client-safe company-invoice lib 밖(서버 전용 Gemini).
 * REGRESSION-FREEZE[admin-ota-voucher-note-en]: 비고 한→영 — manifest
 */
import { geminiTimeoutOpts, getGenAI, getModelName } from '@/lib/gemini-client'

const PROMPT = `Translate the following hotel check-in voucher note from Korean to English.
Rules:
- Output ONLY the English translation, no quotes, no markdown, no preamble.
- Keep booking IDs, names, dates, and amounts unchanged.
- Formal, concise tone suitable for a hotel front-desk voucher.
- If the text is already English, return it unchanged.

Korean note:
`

/** 한글 비고를 영문 바우처용 Notes로 번역. 실패 시 throw. */
export async function translateOtaVoucherNoteToEn(noteKo: string): Promise<string> {
  const raw = String(noteKo || '').trim()
  if (!raw) return ''
  const model = getGenAI().getGenerativeModel({ model: getModelName() })
  const result = await model.generateContent(`${PROMPT}${raw}`, geminiTimeoutOpts(45_000))
  const text = String(result.response.text() || '')
    .replace(/^["'`]|["'`]$/g, '')
    .trim()
  if (!text) throw new Error('비고 영문 번역 결과가 비었습니다.')
  return text
}
