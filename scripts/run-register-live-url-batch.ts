/**
 * 공급사 live URL → preview+confirm 등록대기(pending) 일괄 실행.
 *
 *   npx tsx scripts/run-register-live-url-batch.ts
 *   npx tsx scripts/run-register-live-url-batch.ts --dry-run
 *   npx tsx scripts/run-register-live-url-batch.ts --only=ybtour
 *
 * 필요: dev 서버(localhost:3000), DATABASE_URL, GEMINI_API_KEY, ADMIN_BYPASS_SECRET
 */
import './load-env-for-scripts'

import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { collectSupplierRegisterFacts } from '@/lib/register-facts/collect'
import { registerFactBundleToPasteText } from '@/lib/register-facts-to-paste-text'

const BASE = (process.env.REGISTER_BATCH_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const COOKIE = `admin_bypass=${process.env.ADMIN_BYPASS_SECRET ?? ''}`

type RegisterRoute =
  | '/api/travel/parse-and-register-modetour'
  | '/api/travel/parse-and-register-hanatour'
  | '/api/travel/parse-and-register-ybtour'
  | '/api/travel/parse-and-register-lottetour'
  | '/api/travel/parse-and-register-kyowontour'
  | '/api/travel/parse-and-register-verygoodtour'

type Case = {
  label: string
  /** preview/confirm originSource·brandKey */
  originSource: 'modetour' | 'hanatour' | 'ybtour' | 'verygoodtour' | 'lottetour' | 'kyowontour'
  /** register-facts 수집 공급사 — 없으면 URL-only paste */
  factsSupplier?: CanonicalOverseasSupplierKey | null
  originUrl: string
  travelScope: 'overseas' | 'air_hotel_free'
  route: RegisterRoute
}

const CASES: Case[] = [
  {
    label: 'modetour-package-110029935',
    originSource: 'modetour',
    factsSupplier: 'modetour',
    originUrl: 'https://www.modetour.com/package/110029935',
    travelScope: 'overseas',
    route: '/api/travel/parse-and-register-modetour',
  },
  {
    label: 'modetour-package-104266429',
    originSource: 'modetour',
    factsSupplier: 'modetour',
    originUrl: 'https://www.modetour.com/package/104266429',
    travelScope: 'overseas',
    route: '/api/travel/parse-and-register-modetour',
  },
  {
    label: 'modetour-air-hotel-108826676',
    originSource: 'modetour',
    factsSupplier: 'modetour',
    originUrl: 'https://www.modetour.com/package/108826676',
    travelScope: 'air_hotel_free',
    route: '/api/travel/parse-and-register-modetour',
  },
  {
    label: 'hanatour-package-EEP133260701KEY',
    originSource: 'hanatour',
    factsSupplier: 'hanatour',
    originUrl:
      'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=EEP133260701KEY&prePage=major-products',
    travelScope: 'overseas',
    route: '/api/travel/parse-and-register-hanatour',
  },
  {
    label: 'hanatour-fit-JMB331260701BXF',
    originSource: 'hanatour',
    factsSupplier: 'hanatour',
    originUrl:
      'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=JMB331260701BXF&prePage=major-products',
    travelScope: 'air_hotel_free',
    route: '/api/travel/parse-and-register-hanatour',
  },
  {
    label: 'ybtour-package-ALP1122',
    originSource: 'ybtour',
    factsSupplier: 'ybtour',
    originUrl:
      'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AABW002&evCd=ALP1122-260706QV00',
    travelScope: 'overseas',
    route: '/api/travel/parse-and-register-ybtour',
  },
  {
    label: 'ybtour-fit-CIF1003',
    originSource: 'ybtour',
    factsSupplier: 'ybtour',
    originUrl:
      'https://prdt.ybtour.co.kr/product/detailPackage?menu=FIT&dspSid=ABIB001&evCd=CIF1003-260707OZ00',
    travelScope: 'air_hotel_free',
    route: '/api/travel/parse-and-register-ybtour',
  },
  {
    label: 'lottetour-package-58808',
    originSource: 'lottetour',
    factsSupplier: null,
    originUrl: 'https://www.lottetour.com/evtList/826/857/1063/2333?godId=58808',
    travelScope: 'overseas',
    route: '/api/travel/parse-and-register-lottetour',
  },
  {
    label: 'lottetour-package-65222',
    originSource: 'lottetour',
    factsSupplier: null,
    originUrl: 'https://www.lottetour.com/evtList/826/854/1000/4900?godId=65222',
    travelScope: 'overseas',
    route: '/api/travel/parse-and-register-lottetour',
  },
  {
    label: 'kyowontour-package-MCP160260622WS01',
    originSource: 'kyowontour',
    factsSupplier: null,
    originUrl:
      'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=MCP160260622WS01&menuCode=M510602&brandId=0',
    travelScope: 'overseas',
    route: '/api/travel/parse-and-register-kyowontour',
  },
  {
    label: 'kyowontour-fit-AWW317260621SQ02',
    originSource: 'kyowontour',
    factsSupplier: null,
    originUrl:
      'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=AWW317260621SQ02&menuCode=M5306&brandId=3',
    travelScope: 'air_hotel_free',
    route: '/api/travel/parse-and-register-kyowontour',
  },
  {
    label: 'verygoodtour-package-CPP7272',
    originSource: 'verygoodtour',
    factsSupplier: 'verygoodtour',
    originUrl:
      'https://www.verygoodtour.com/Product/PackageDetail?ProCode=CPP7272-260708TW5&PriceSeq=1',
    travelScope: 'overseas',
    route: '/api/travel/parse-and-register-verygoodtour',
  },
  {
    label: 'verygoodtour-fit-APP2586',
    originSource: 'verygoodtour',
    factsSupplier: 'verygoodtour',
    originUrl:
      'https://www.verygoodtour.com/Product/PackageDetail?ProCode=APP2586-2606239G35&PriceSeq=4&MenuCode=leaveLayer',
    travelScope: 'air_hotel_free',
    route: '/api/travel/parse-and-register-verygoodtour',
  },
]

async function postJson<T>(path: string, body: unknown): Promise<{ status: number; json: T }> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: COOKIE },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as T
  return { status: res.status, json }
}

async function buildPasteText(c: Case): Promise<{ text: string; factsOk: boolean }> {
  if (c.factsSupplier) {
    const bundle = await collectSupplierRegisterFacts(c.factsSupplier, c.originUrl)
    if (bundle) {
      return { text: registerFactBundleToPasteText(bundle), factsOk: true }
    }
  }
  return {
    text: [`출처 URL: ${c.originUrl}`, `공급사: ${c.originSource}`].join('\n'),
    factsOk: false,
  }
}

async function registerOne(c: Case, dryRun: boolean): Promise<void> {
  console.log(`\n=== ${c.label} ===`)
  const { text, factsOk } = await buildPasteText(c)
  if (!factsOk) {
    console.warn('WARN: register-facts collector missing — URL-only paste (detail-collect on confirm)')
  }
  console.log('paste chars:', text.length)

  if (dryRun) {
    console.log('dry-run: skip preview/confirm')
    return
  }

  const brandKey = c.originSource
  const originSource = c.originSource
  const previewBody = {
    mode: 'preview',
    brandKey,
    originSource,
    originUrl: c.originUrl,
    travelScope: c.travelScope,
    text,
  }
  const preview = await postJson<{
    success?: boolean
    previewToken?: string
    previewContentDigest?: string
    parsed?: unknown
    error?: string
  }>(c.route, previewBody)
  console.log('preview http', preview.status, preview.json.success ? 'ok' : preview.json.error ?? 'fail')
  if (!preview.json.success || !preview.json.previewToken) {
    console.log(JSON.stringify(preview.json, null, 2))
    return
  }

  const confirm = await postJson<{ success?: boolean; productId?: string; slug?: string; error?: string }>(
    c.route,
    {
      ...previewBody,
      mode: 'confirm',
      previewToken: preview.json.previewToken,
      previewContentDigest: preview.json.previewContentDigest,
      parsed: preview.json.parsed,
    },
  )
  console.log('confirm http', confirm.status, confirm.json.success ? 'ok' : confirm.json.error ?? 'fail')
  if (confirm.json.success) {
    console.log('productId', confirm.json.productId, 'slug', confirm.json.slug, '→ registrationStatus pending')
  } else {
    console.log(JSON.stringify(confirm.json, null, 2))
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length)
  const cases = onlyArg
    ? CASES.filter(
        (c) =>
          c.originSource === onlyArg ||
          c.label.includes(onlyArg) ||
          c.factsSupplier === onlyArg,
      )
    : CASES
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required')
    process.exit(1)
  }
  if (!dryRun && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    console.error('GEMINI_API_KEY required for preview parse')
    process.exit(1)
  }
  if (!dryRun && !process.env.ADMIN_BYPASS_SECRET) {
    console.error('ADMIN_BYPASS_SECRET required')
    process.exit(1)
  }

  for (const c of cases) {
    await registerOne(c, dryRun)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
