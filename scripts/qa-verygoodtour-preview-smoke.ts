/**
 * 참좋은(verygoodtour) 스타일 본문으로 parse-and-register 미리보기 스모크.
 * npx tsx scripts/qa-verygoodtour-preview-smoke.ts
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { SUPPLIER_ORIGIN_CANONICAL } from '@/lib/overseas-supplier-canonical-keys'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  try {
    const txt = readFileSync(p, 'utf8')
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  } catch {
    /* no .env.local */
  }
}

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:3000'

/** 참좋은형 항공 한 줄 + 옵션/쇼핑 표·4박5일 (실제 상품과 유사한 스모크) */
const VERYGOODTOUR_PASTE = `상품번호 JPP423
제목: [스모크] 오사카 4박5일
일정: 4박 5일

항공 스케줄
2026.07.07(화) 19:20 인천 출발
2026.07.07(화) 21:40 오사카 도착
OZ1234

2026.07.11(토) 10:10 오사카 출발
2026.07.11(토) 12:30 인천 도착
OZ1235

선택관광 안내
선택명 | 성인 | 아동 | 소요시간
교토 당일 | 80,000원 | 60,000원 | 약 8시간
USJ | 150,000원 | 140,000원 | 종일

쇼핑센터 안내
쇼핑품목 | 쇼핑장소 | 예상소요시간 | 환불여부
잡화 | 면세점 | 40분 | 조건부

포함 사항
항공권, 숙박, 식사(일부)

불포함 사항
1인실 객실 추가요금 200,000원

꼭 확인하세요
- 여권 잔여 6개월 이상
- 현지에서 유효한 신용카드 지참
`

async function main() {
  loadEnvLocal()
  const secret = process.env.ADMIN_BYPASS_SECRET
  if (!secret) {
    console.log(JSON.stringify({ ok: false, error: 'ADMIN_BYPASS_SECRET missing (need .env.local for API smoke)' }))
    process.exit(1)
  }

  const originUrl =
    'https://www.verygoodtour.com/Goods/PackageDetail?ProCode=JPP423-260329TW&PriceSeq=1'

  const cookie = `admin_bypass=${encodeURIComponent(secret)}`
  const headers = { 'Content-Type': 'application/json', Cookie: cookie }

  const previewBody = {
    mode: 'preview',
    text: VERYGOODTOUR_PASTE,
    brandKey: SUPPLIER_ORIGIN_CANONICAL.verygoodtour,
    originSource: SUPPLIER_ORIGIN_CANONICAL.verygoodtour,
    travelScope: 'overseas',
    originUrl,
  }

  const pr = await fetch(`${BASE}/api/travel/parse-and-register-verygoodtour`, {
    method: 'POST',
    headers,
    body: JSON.stringify(previewBody),
  })
  const previewJson = (await pr.json()) as Record<string, unknown>

  const token = typeof previewJson.previewToken === 'string' ? previewJson.previewToken : null
  const parsed = previewJson.parsed as Record<string, unknown> | undefined
  const prices = parsed?.prices as unknown[] | undefined
  const schedule = parsed?.schedule as unknown[] | undefined
  const gemini = previewJson.geminiInferred as Record<string, unknown> | undefined

  console.log(
    JSON.stringify(
      {
        httpStatus: pr.status,
        httpOk: pr.status === 200,
        previewTokenPresent: Boolean(token && token.length > 0),
        previewTokenLen: token?.length ?? 0,
        note: 'finishReason·endsWithClosingBrace는 서버 터미널 [parseForRegister] preview Gemini response shape 로그에서 확인',
        geminiInferred: gemini ?? null,
        parsedSummary: parsed
          ? {
              originCode: parsed.originCode,
              title: parsed.title,
              airline: parsed.airline,
              departureSegmentText: parsed.departureSegmentText,
              optionalTourSummaryText: parsed.optionalTourSummaryText,
              shoppingSummaryText: parsed.shoppingSummaryText,
              headerBadges: parsed.headerBadges,
              pricesLength: Array.isArray(prices) ? prices.length : null,
              scheduleLength: Array.isArray(schedule) ? schedule.length : null,
            }
          : null,
        error: previewJson.error ?? null,
      },
      null,
      2
    )
  )

  process.exit(pr.ok && token ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
