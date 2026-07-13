/**
 * 봉투어 변환 wall-clock — [사실 가져오기] bundle 재사용 vs 재수집 대조.
 *
 *   $env:SKIP_REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI='1'
 *   npx tsx scripts/bench-register-convert-timing.ts
 */
import './load-env-for-scripts'

import { collectSupplierRegisterFacts } from '@/lib/register-facts/collect'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import type { SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { registerFactBundleToPasteText } from '@/lib/register-facts-to-paste-text'
import { parseYbtourRegisterFromApi } from '@/lib/ybtour-register-api-parse'
import { augmentYbtourParsedWithDetailCollect } from '@/lib/ybtour-register-detail-collect'
import { parseModetourRegisterFromApi } from '@/lib/modetour-register-api-parse'
import { augmentModetourParsedWithDetailCollect } from '@/lib/modetour-register-detail-collect'
import { augmentHanatourParsedWithDetailCollect } from '@/lib/hanatour-register-detail-collect'
import { parseHanatourRegisterFromApi } from '@/lib/hanatour-register-api-parse'
import { parseLottetourRegisterFromApi } from '@/lib/lottetour-register-api-parse'
import { augmentLottetourParsedWithDetailCollect } from '@/lib/lottetour-register-detail-collect'
import { parseKyowontourRegisterFromApi } from '@/lib/kyowontour-register-api-parse'
import { augmentKyowontourParsedWithTabDataCollect } from '@/lib/kyowontour-register-tab-data-collect'
import { applyRegisterPostAugmentSchedulePipeline } from '@/lib/register-parse-post-augment'

process.env.SKIP_REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI = '1'

type Case = {
  supplier: CanonicalOverseasSupplierKey
  url: string
  label: string
}

const CASES: Case[] = [
  {
    supplier: 'ybtour',
    label: 'ybtour-AVP8307',
    url: 'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AABG001&evCd=AVP8307-260715VJ01',
  },
  {
    supplier: 'lottetour',
    label: 'lottetour-B41A',
    url: 'https://www.lottetour.com/evtDetail/826/857/1063/1671?evtCd=B41A260720KE019',
  },
  {
    supplier: 'kyowontour',
    label: 'kyowontour-EWP132',
    url: 'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=EWP132260715OZ01&menuCode=M51010101&brandId=3',
  },
  {
    supplier: 'hanatour',
    label: 'hanatour-CPP171',
    url: 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=CPP171260715TWA&prePage=major-products',
  },
  {
    supplier: 'modetour',
    label: 'modetour-104953272',
    url: 'https://www.modetour.com/package/104953272',
  },
]

async function convertWithOpts(
  supplier: CanonicalOverseasSupplierKey,
  url: string,
  paste: string,
  bundle: SupplierRegisterFactBundle | null,
): Promise<{ days: number; title: string }> {
  const opts = {
    originUrl: url,
    travelScope: 'package' as const,
    prefetchedFactBundle: bundle ?? undefined,
  }
  let parsed: Record<string, unknown>
  switch (supplier) {
    case 'ybtour': {
      const skeleton = await parseYbtourRegisterFromApi(paste, 'ybtour', opts)
      parsed = (await augmentYbtourParsedWithDetailCollect(skeleton, { originUrl: url })) as Record<
        string,
        unknown
      >
      break
    }
    case 'modetour': {
      const skeleton = await parseModetourRegisterFromApi(paste, 'modetour', opts)
      parsed = (await augmentModetourParsedWithDetailCollect(skeleton, { originUrl: url })) as Record<
        string,
        unknown
      >
      break
    }
    case 'hanatour': {
      const skeleton = await parseHanatourRegisterFromApi(paste, 'hanatour', opts)
      parsed = (await augmentHanatourParsedWithDetailCollect(skeleton, { originUrl: url })) as Record<
        string,
        unknown
      >
      break
    }
    case 'lottetour': {
      const skeleton = await parseLottetourRegisterFromApi(paste, 'lottetour', opts)
      parsed = (await augmentLottetourParsedWithDetailCollect(skeleton, {
        originUrl: url,
      })) as Record<string, unknown>
      break
    }
    case 'kyowontour': {
      const skeleton = await parseKyowontourRegisterFromApi(paste, 'kyowontour', opts)
      parsed = (await augmentKyowontourParsedWithTabDataCollect(skeleton, {
        originUrl: url,
      })) as Record<string, unknown>
      break
    }
    default:
      throw new Error(`unsupported ${supplier}`)
  }
  parsed = (await applyRegisterPostAugmentSchedulePipeline(parsed, {
    forcedBrandKey: supplier,
    travelScope: 'package',
    mode: 'preview',
    logPrefix: `bench-${supplier}`,
  })) as Record<string, unknown>
  const schedule = (parsed.schedule as unknown[]) ?? []
  return {
    days: schedule.length,
    title: String(parsed.title ?? '').slice(0, 48),
  }
}

function ms(n: number): string {
  return `${(n / 1000).toFixed(1)}s`
}

async function main() {
  console.log('=== bench-register-convert-timing (Gemini SKIP=1) ===\n')
  console.log(
    '시나리오: 사실가져오기 → 봉투어변환(bundle재사용) vs 봉투어변환(bundle없이 재수집)\n',
  )

  const rows: Array<Record<string, unknown>> = []

  for (const c of CASES) {
    process.stderr.write(`… ${c.label}\n`)
    const tFacts0 = Date.now()
    const bundle = await collectSupplierRegisterFacts(c.supplier, c.url)
    const factsMs = Date.now() - tFacts0
    if (!bundle) {
      rows.push({ label: c.label, error: 'facts null', factsMs })
      console.log(`[fail] ${c.label} facts null (${ms(factsMs)})`)
      continue
    }
    const paste = registerFactBundleToPasteText(bundle)

    const tWith0 = Date.now()
    const withBundle = await convertWithOpts(c.supplier, c.url, paste, bundle)
    const convertWithBundleMs = Date.now() - tWith0

    const tWithout0 = Date.now()
    const withoutBundle = await convertWithOpts(c.supplier, c.url, paste, null)
    const convertWithoutBundleMs = Date.now() - tWithout0

    const operatorPathMs = factsMs + convertWithBundleMs
    const row = {
      label: c.label,
      supplier: c.supplier,
      factsMs,
      convertWithBundleMs,
      convertWithoutBundleMs,
      operatorPathMs,
      savedVsNoReuseMs: convertWithoutBundleMs - convertWithBundleMs,
      days: withBundle.days,
      title: withBundle.title,
    }
    rows.push(row)
    console.log(
      `[ok] ${c.label}\n` +
        `  사실가져오기:           ${ms(factsMs)}\n` +
        `  봉투어변환(bundle재사용): ${ms(convertWithBundleMs)}\n` +
        `  봉투어변환(재수집):       ${ms(convertWithoutBundleMs)}\n` +
        `  운영자 경로(사실+변환):  ${ms(operatorPathMs)}\n` +
        `  변환 절감(재사용 대비):  ${ms(Math.max(0, convertWithoutBundleMs - convertWithBundleMs))}\n` +
        `  scheduleDays=${withBundle.days} / withoutDays=${withoutBundle.days}\n`,
    )
  }

  const ok = rows.filter((r) => !r.error)
  if (ok.length) {
    const avg = (k: string) =>
      ok.reduce((s, r) => s + Number(r[k] ?? 0), 0) / ok.length
    console.log('--- averages ---')
    console.log(`사실가져오기 avg:           ${ms(avg('factsMs'))}`)
    console.log(`봉투어변환(bundle) avg:     ${ms(avg('convertWithBundleMs'))}`)
    console.log(`봉투어변환(재수집) avg:     ${ms(avg('convertWithoutBundleMs'))}`)
    console.log(`운영자 경로(사실+변환) avg: ${ms(avg('operatorPathMs'))}`)
    console.log(`변환 절감 avg:              ${ms(Math.max(0, avg('savedVsNoReuseMs')))}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
