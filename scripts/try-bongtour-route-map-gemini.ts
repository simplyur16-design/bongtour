/**
 * 동선지도 — 등록 저장분·교통 스모크.
 *
 *   npx tsx scripts/try-bongtour-route-map-gemini.ts --slug=pkg-vg-0025
 */
import { loadEnvForScripts } from './load-env-for-scripts'
loadEnvForScripts()

import { testGeminiConnection } from '@/lib/gemini-client'
import { loadDevProductSurfaceLiveMock } from '@/lib/dev-product-surface-live-mock'

function argsNamed(name: string): string[] {
  return process.argv
    .filter((a) => a.startsWith(`--${name}=`))
    .map((a) => a.slice(name.length + 3).trim())
    .filter(Boolean)
}

async function main() {
  const conn = await testGeminiConnection()
  console.log('[route-map] connection', { ok: conn.ok, model: conn.model, error: conn.error })
  if (!conn.ok) {
    process.exitCode = 1
    return
  }

  const keys = [...argsNamed('id'), ...argsNamed('slug')]
  const targets = keys.length > 0 ? keys : [undefined]
  let failures = 0

  for (const idOrSlug of targets) {
    const mock = await loadDevProductSurfaceLiveMock({
      idOrSlug,
      callGemini: true,
      skipMapImage: true,
    })
    if (!mock) {
      console.error('[route-map] NOT FOUND', idOrSlug || '(default)')
      failures++
      continue
    }
    const modes = mock.mapDraft.edges.map((e) => e.label)
    const hasFakeCar = modes.includes('전용차량') && !/전용\s*차량/.test(mock.included.join(' '))
    console.log('[route-map]', {
      slug: mock.slug,
      cities: mock.cities,
      edges: mock.mapDraft.edges.map((e) => `${e.from}->${e.to}:${e.label}`),
      routeSummary: mock.mapDraft.routeSummary,
      mapPersist: mock.mapPersistStatus,
      mapImageUrl: Boolean(mock.mapImageUrl),
      descChars: mock.schedule.map((d) => d.description.length),
      mapSource: mock.mapSource,
    })
    if (hasFakeCar && mock.slug === 'pkg-vg-0025') {
      console.error('[route-map] FAIL: 원문에 없는 전용차량')
      failures++
    }
    if (!modes.some((m) => /버스|항공|케이블|기차|국내선|이동|전용|선박|도보|직항/.test(m))) {
      failures++
    }
    if (!mock.mapImageUrl) {
      console.error(
        '[route-map] FAIL: 등록 시 저장된 지도 없음 — npx tsx scripts/persist-bongtour-route-map.ts --slug=',
        mock.slug || mock.productId,
        mock.mapImageFailReason
      )
      failures++
    }
  }

  if (failures > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
