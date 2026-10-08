/**
 * 이미지/스캔 OTA 바우처 PDF → 본문 텍스트 (Gemini vision).
 * extractPdfText가 비면 관리자 인보이스/바우처 파이프라인에서 사용.
 * REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 바우처 PDF OCR — manifest
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { geminiTimeoutOpts, getGenAI, getModelName } from '@/lib/gemini-client'

/** 스캔 PDF에서 extractPdfText가 제어문자만 남을 때 OCR로 넘기기 위한 usable 판정. */
export function isUsableExtractedPdfText(text: string): boolean {
  const printable = String(text ?? '').replace(/[^\p{L}\p{N}]+/gu, '')
  return printable.length >= 40
}

const PROMPT = `You are extracting a hotel check-in voucher / booking confirmation (Agoda, Trip.com, Booking.com, etc.).

Read ALL pages of this PDF carefully. Output ONLY plain text in Korean+English labels so a regex parser can read it. No markdown.

Critical:
- Booking ID : MUST be the primary Booking ID printed on the voucher (for visa/check-in). Do not swap with hotel confirmation.
- If a separate hotel confirmation / 예약 번호 differs, put it on 예약 번호 : line.
- 결제일 : MUST be the payment/booked/transaction date (YYYY-MM-DD) used for FX conversion.

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
결제일 : YYYY-MM-DD (payment / booked / transaction date — required for FX)
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

async function runGeminiPdfOcr(
  pdfBytes: Uint8Array,
  prompt: string,
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
    { text: prompt },
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

export async function extractOtaVoucherPdfTextViaGemini(
  pdfBytes: Uint8Array,
): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  return runGeminiPdfOcr(pdfBytes, PROMPT)
}

const AIR_ETICKET_PROMPT = `You are extracting an airline e-ticket / passenger itinerary receipt (any carrier: KE, OZ, JL, NH, UA, etc.).

Read ALL pages carefully (Korean and English versions if both present). Output ONLY plain text with stable labels so a regex parser can read it. No markdown.

Required lines when present (use these exact English labels):
Passenger Name : <names comma-separated in passport order — one list>
Booking Reference : <airline PNR>
PNR : <airline PNR if shown separately>
eTicket number : <ALL ticket numbers comma-separated in the SAME order as Passenger Name — each passenger usually has their own number, never drop any>
Ticket Number : <same as eTicket number list if printed that way>

Critical: if there are 8 passengers there are usually 8 e-ticket numbers — list every one, comma-separated, same order as names.

For each flight segment, output a block like:
Flight : <airline code + number, e.g. KE123 or OZ701>
Airline : <airline name>
From : <IATA>
To : <IATA>
Dep Terminal : <departure terminal exactly as printed, e.g. 1, 2, T1, International — REQUIRED when shown on the ticket>
Arr Terminal : <arrival terminal exactly as printed — REQUIRED when shown>
Terminal : <if only one terminal is printed without dep/arr distinction, put it here too>
Departure : <date time as printed>
Arrival : <date time as printed>
Cabin : <class if shown>
Status : <OK/confirmed if shown>

Terminals are critical — never omit Terminal / 터미널 / Terminal No from the e-ticket when present.

Notices / remarks (CRITICAL — clean, language-separated):
If the ticket has 주의사항, 참고사항, Important Notice, Remarks, baggage notes, check-in deadlines, output them as bullet lines:

Notices (KO) :
- <Korean-only bullets. Do NOT put passenger names in these lines.>
- <Include 주의사항 and 참고사항. Keep meaning; rewrite "NAME, NAME은 …" templates into subject-free bullets like "유효한 신분증을 제시해야 합니다.">

Notices (EN) :
- <English-only bullets. Do NOT put passenger names in these lines.>
- <Rewrite "NAME, NAME must …" templates into subject-free bullets like "Passengers must present the valid ID used to purchase the ticket.">

Strict rules for Notices:
- Notices (KO) must contain Korean only. Notices (EN) must contain English only. Never duplicate the same mixed blob in both.
- Replace any Trip.com / 트립닷컴 / Agoda brand in notice text with 봉투어 (KO) or BongTour (EN). Keep the sentence meaning.
- NEVER prepend or embed the passenger name list inside Notices — names belong only under Passenger Name.
- Prefer airline/carrier notice text; if OTA fine print remains, rewrite brand to 봉투어/BongTour as above.

Copy every passenger name exactly as printed under Passenger Name only (including slash form KIM/MINSU).`

/**
 * 항공사 e-ticket 스캔 PDF → 승객·PNR·편명 텍스트.
 * REGRESSION-FREEZE[admin-ota-air-voucher]: extractAirlineEticketPdfTextViaGemini — manifest
 */
export async function extractAirlineEticketPdfTextViaGemini(
  pdfBytes: Uint8Array,
): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  return runGeminiPdfOcr(pdfBytes, AIR_ETICKET_PROMPT)
}
