/**
 * eSIM QR 알림톡 템플릿이 Solapi에 존재하고 installPath 버튼·변수와 맞는지 검증.
 *   npx tsx scripts/verify-solapi-esim-qr-template.ts
 *
 * 네트워크·자격 없으면 skip(exit 0). 템플릿 불일치 시 exit 1.
 * REGRESSION-FREEZE[bongsim-esim-qr-alimtalk-install-path]: manifest
 */
import './load-env-for-scripts'
import crypto from 'crypto'

/** 승인 운영본 — `https://bongtour.com#{installPath}` 버튼 */
export const BONGSIM_ESIM_QR_ALIMTALK_TEMPLATE_ID_SSOT = 'KA01TP260529080045939hjuDabvEjcg'

async function solapiGet(path: string): Promise<{ status: number; json: unknown }> {
  const apiKey = process.env.SOLAPI_API_KEY?.trim()
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim()
  if (!apiKey || !apiSecret) {
    return { status: 0, json: null }
  }
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex')
  const auth = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
  const res = await fetch(`https://api.solapi.com${path}`, { headers: { Authorization: auth } })
  const text = await res.text()
  try {
    return { status: res.status, json: JSON.parse(text) }
  } catch {
    return { status: res.status, json: { raw: text.slice(0, 200) } }
  }
}

function assertTemplateShape(t: {
  templateId?: string
  status?: string
  content?: string
  variables?: Array<{ name?: string } | string> | Record<string, unknown>
  buttons?: Array<{ linkMo?: string; linkPc?: string; buttonName?: string }>
}): string[] {
  const errors: string[] = []
  if ((t.status ?? '').toUpperCase() !== 'APPROVED') {
    errors.push(`status=${t.status ?? 'missing'} (want APPROVED)`)
  }
  const content = t.content ?? ''
  if (!content.includes('#{orderNumber}')) {
    errors.push('content missing #{orderNumber}')
  }
  // Solapi list API often omits/empties `variables`; button + content are SSOT.
  const qrBtn = (t.buttons ?? []).find((b) => /QR|설치/i.test(b.buttonName ?? ''))
  const link = qrBtn?.linkMo || qrBtn?.linkPc || ''
  if (!link.includes('#{installPath}')) {
    errors.push(`QR button link must include #{installPath}, got: ${link || '(none)'}`)
  }
  if (link && !/^https:\/\/bongtour\.com#\{installPath\}/.test(link.trim())) {
    errors.push(`QR button should be https://bongtour.com#{installPath}, got: ${link}`)
  }
  return errors
}

async function main() {
  const envTid = process.env.SOLAPI_TPL_ESIM_QR_DELIVERED?.trim() || ''
  if (!process.env.SOLAPI_API_KEY?.trim() || !process.env.SOLAPI_API_SECRET?.trim()) {
    console.log('[skip] verify-solapi-esim-qr-template: no SOLAPI credentials')
    return
  }
  if (!envTid) {
    console.error('[fail] SOLAPI_TPL_ESIM_QR_DELIVERED is empty')
    process.exit(1)
  }

  if (envTid !== BONGSIM_ESIM_QR_ALIMTALK_TEMPLATE_ID_SSOT) {
    console.error(
      `[fail] SOLAPI_TPL_ESIM_QR_DELIVERED=${envTid} !== SSOT ${BONGSIM_ESIM_QR_ALIMTALK_TEMPLATE_ID_SSOT}`,
    )
    process.exit(1)
  }

  const list = await solapiGet('/kakao/v2/templates?limit=100')
  if (list.status === 0) {
    console.log('[skip] solapi unreachable')
    return
  }
  const templates = (list.json as { templateList?: unknown[] })?.templateList ?? []
  const hit = templates.find(
    (x) =>
      x &&
      typeof x === 'object' &&
      (x as { templateId?: string }).templateId === envTid,
  ) as
    | {
        templateId?: string
        status?: string
        content?: string
        variables?: Array<{ name?: string } | string> | Record<string, unknown>
        buttons?: Array<{ linkMo?: string; linkPc?: string; buttonName?: string }>
      }
    | undefined

  if (!hit) {
    console.error(`[fail] template ${envTid} not found in Solapi account (404/missing)`)
    process.exit(1)
  }

  const shapeErrors = assertTemplateShape(hit)
  if (shapeErrors.length > 0) {
    console.error('[fail] template shape:', shapeErrors.join('; '))
    process.exit(1)
  }

  console.log('[ok] verify-solapi-esim-qr-template', envTid)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
