/**
 * 이미지/스캔 OTA 바우처 PDF → 본문 텍스트 (Gemini vision).
 * extractPdfText가 비면 관리자 인보이스/바우처 파이프라인에서 사용.
 * REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 바우처 PDF OCR — manifest
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { geminiTimeoutOpts, getGenAI, getModelName } from '@/lib/gemini-client'

const PROMPT = `You are extracting a hotel check-in voucher / booking confirmation (Agoda, Trip.com, Booking.com, etc.).

Read ALL pages of this PDF carefully. Output ONLY plain text in Korean+English labels so a regex parser can read it. No markdown.

Critical:
- Booking ID : MUST be the primary Booking ID printed on the voucher (for visa/check-in). Do not swap with hotel confirmation.
- If a separate hotel confirmation / 예약 번호 differs, put it on 예약 번호 : line.

Required lines when present (use exact labels):
Booking ID : <id>
예약 번호 : <id or hotel confirmation>
고객명 : <guest>
Guest : <guest>
숙소명 : <korean name if any> / <english name>
Property : <english or bilingual name>
주소 : <address>
Address : <address>
전화 : <phone>
체크인 : <date time>
체크아웃 : <date time>
객실 타입 : <room>
Room Type : <room>
침대 타입 : <bed>
객실 수 : <n>
성인 수 : <n>
아동 수 : <n>
조식 : <포함/불포함/상세>
Breakfast : <included/not included/detail>
객실 편의시설 : <comma separated amenities only>
포함사항 : <tax/service fee breakdown if listed>
불포함사항 : <...>
취소 정책 : <cancellation policy only, one paragraph>
특별 요청 : <...>
결제 방법 : <...>
세금 및 봉사료 포함 or 세금 별도 (pick one line if stated)
1박 : USD <amount> (if shown)
총 결제 금액 : USD <amount> or KRW <amount>
Nights : <n>박

Copy cancellation policy and amenities fully. If a field is missing, omit that line.`

const OCR_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-3-flash-preview',
  'gemini-1.5-flash',
].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i)

export async function extractOtaVoucherPdfTextViaGemini(
  pdfBytes: Uint8Array,
): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  const key = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!key) return { ok: false, error: 'GEMINI_API_KEY 미설정 — 스캔 PDF OCR 불가' }

  const base64 = Buffer.from(pdfBytes).toString('base64')
  const parts = [
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64,
      },
    },
    { text: PROMPT },
  ]

  let lastError = ''
  for (const modelName of OCR_MODELS) {
    try {
      const genAI = modelName === getModelName() ? getGenAI() : new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent(parts, geminiTimeoutOpts(120_000))
      const text = result.response.text()?.trim() ?? ''
      if (!text || text.length < 20) {
        lastError = `${modelName}: empty OCR`
        continue
      }
      return { ok: true, text, model: modelName }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
      continue
    }
  }
  return { ok: false, error: lastError || 'Gemini OCR 실패' }
}
