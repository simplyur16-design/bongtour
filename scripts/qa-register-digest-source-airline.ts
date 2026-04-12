/**
 * 우선순위 1~3 QA: digest 정합성 / sourceSummary / airlineTransport
 * npx tsx scripts/qa-register-digest-source-airline.ts
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { SUPPLIER_ORIGIN_CANONICAL } from '@/lib/overseas-supplier-canonical-keys'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  const txt = readFileSync(p, 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[m[1]]) process.env[m[1]] = v
  }
}

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:3000'

const BASE_PASTE = `상품코드: QA-DIGEST-${Date.now()}
제목: digest QA 상품
일정: 2박3일
가격: 성인 1,500,000원 2026-05-01 출발확정

항공사: 중국남방항공
출발 : 인천 2026.07.07(화) 19:20 → 연길 2026.07.07(화) 20:40 CZ6074
도착 : 연길 2026.07.10(금) 10:10 → 인천 2026.07.10(금) 13:25 CZ6073

쇼핑: 2회 안내
쇼핑품목 | 쇼핑장소 | 예상소요시간 | 환불여부
잡화 | 면세점 | 40분 | 조건부
`

const AIRLINE_ONLY = `항공사: 중국남방항공
출발 : 인천 2026.07.07(화) 19:20 → 연길 CZ6074
도착 : 연길 2026.07.10(금) 10:10 → 인천 CZ6073`

async function main() {
  loadEnvLocal()
  const secret = process.env.ADMIN_BYPASS_SECRET
  if (!secret) throw new Error('ADMIN_BYPASS_SECRET missing')

  const cookie = `admin_bypass=${encodeURIComponent(secret)}`
  const headers = { 'Content-Type': 'application/json', Cookie: cookie }

  // —— A: preview with airlineTransport + admin-like body ——
  const previewBody = {
    mode: 'preview',
    text: BASE_PASTE,
    brandKey: SUPPLIER_ORIGIN_CANONICAL.modetour,
    originSource: SUPPLIER_ORIGIN_CANONICAL.modetour,
    travelScope: 'overseas',
    originUrl: 'https://example.com/p/qa-digest',
    pastedBlocks: {
      airlineTransport: AIRLINE_ONLY,
    },
  }

  const pr = await fetch(`${BASE}/api/travel/parse-and-register-modetour`, {
    method: 'POST',
    headers,
    body: JSON.stringify(previewBody),
  })
  const previewJson = (await pr.json()) as Record<string, unknown>
  console.log('[1] PREVIEW status', pr.status)
  if (!pr.ok) {
    console.log('[1] PREVIEW body', JSON.stringify(previewJson).slice(0, 800))
    process.exit(1)
  }

  const digest = previewJson.previewContentDigest as string | undefined
  const token = previewJson.previewToken as string | undefined
  const parsed = previewJson.parsed as Record<string, unknown> | undefined
  const manual = previewJson.manualPasted as { pastedBlocksPreview?: Record<string, string> } | undefined
  const cp = previewJson.correctionPreview as {
    issueHintDetails?: Array<{ field: string; reason: string; evidence: { sourceSummary?: string | null } }>
  } | undefined

  console.log('[1a] previewContentDigest present', Boolean(digest?.trim()), 'len', digest?.length ?? 0)
  console.log('[1b] manualPasted.pastedBlocksPreview.airlineTransport present', Boolean(manual?.pastedBlocksPreview?.airlineTransport))
  if (manual?.pastedBlocksPreview?.airlineTransport) {
    console.log('[1b] airlineTransport preview first 80 chars', manual.pastedBlocksPreview.airlineTransport.slice(0, 80))
  }

  // sourceSummary samples (first 5 issues)
  const hints = cp?.issueHintDetails ?? []
  console.log('[2] issueHintDetails count', hints.length)
  for (let i = 0; i < Math.min(5, hints.length); i++) {
    const h = hints[i]!
    console.log(`[2] #${i} field=${h.field} sourceSummary=${JSON.stringify(h.evidence?.sourceSummary ?? null)}`)
  }

  // Flight-related hints
  for (const h of hints) {
    if (/flight|inbound|outbound|shopping|optional|hotel/i.test(h.field)) {
      const s = h.evidence?.sourceSummary ?? ''
      const rs = (h as { evidence?: { rawSnippet?: string | null } }).evidence?.rawSnippet ?? ''
      const hasDash = s.includes('—')
      console.log(`[2f] field=${h.field} hasAxisSeparator=${hasDash} summary=${JSON.stringify(s).slice(0, 120)}`)
      console.log(`[2s] field=${h.field} rawSnippetHead=${JSON.stringify(String(rs).slice(0, 100))}`)
    }
  }

  if (!token || !digest || !parsed?.originCode) {
    console.error('[FAIL] missing token/digest/parsed.originCode')
    process.exit(1)
  }

  // —— Tamper confirm (server 409) ——
  const badConfirm = await fetch(`${BASE}/api/travel/parse-and-register-modetour`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      mode: 'confirm',
      previewToken: token,
      previewContentDigest: digest,
      text: `${BASE_PASTE}\n\nTAMPER_LINE_FOR_DIGEST`,
      brandKey: SUPPLIER_ORIGIN_CANONICAL.modetour,
      originSource: SUPPLIER_ORIGIN_CANONICAL.modetour,
      travelScope: 'overseas',
      originUrl: 'https://example.com/p/qa-digest',
      pastedBlocks: previewBody.pastedBlocks,
      parsed,
    }),
  })
  const badJson = (await badConfirm.json()) as { error?: string }
  console.log('[3] TAMPER_CONFIRM status', badConfirm.status, 'error', badJson.error?.slice(0, 120))

  // —— Missing digest confirm ——
  const noDigest = await fetch(`${BASE}/api/travel/parse-and-register-modetour`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      mode: 'confirm',
      previewToken: token,
      text: BASE_PASTE,
      brandKey: SUPPLIER_ORIGIN_CANONICAL.modetour,
      originSource: SUPPLIER_ORIGIN_CANONICAL.modetour,
      travelScope: 'overseas',
      originUrl: 'https://example.com/p/qa-digest',
      pastedBlocks: previewBody.pastedBlocks,
      parsed,
    }),
  })
  const noDJson = (await noDigest.json()) as { error?: string }
  console.log('[4] NO_DIGEST_CONFIRM status', noDigest.status, 'error', noDJson.error?.slice(0, 100))

  const ok409 = badConfirm.status === 409
  const ok400nod = noDigest.status === 400
  console.log('[SUMMARY] tamper=>409', ok409, 'noDigest=>400', ok400nod)
  process.exit(ok409 && ok400nod ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
