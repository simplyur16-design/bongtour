/**
 * 일정 동선 지도 샘플 1건 생성 (전체 적용 전 품질 확인용).
 *
 *   npx tsx scripts/sample-itinerary-route-map.ts
 *   npx tsx scripts/sample-itinerary-route-map.ts --id=<productId>
 *   npx tsx scripts/sample-itinerary-route-map.ts --persist   # rawMeta에도 저장
 */
import './load-env'
import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'
import { generateImageWithGemini, IMAGEN_MODEL } from '../lib/gemini-image-generate'
import { convertToWebp } from '../lib/image-to-webp'
import { resolveItineraryRouteMapCountry } from '../lib/itinerary-route-map-country'
import {
  extractItineraryRouteMapHubs,
  parseScheduleJsonForRouteMap,
} from '../lib/itinerary-route-map-hubs'
import { buildItineraryRouteMapPrompt } from '../lib/itinerary-route-map-prompt'
import { generateAndPersistItineraryRouteMap } from '../lib/itinerary-route-map-generate'

function argFlag(name: string) {
  return process.argv.includes(name)
}
function argValue(name: string) {
  const pref = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(pref))
  return hit ? hit.slice(pref.length) : null
}

async function pickSampleId(): Promise<string> {
  const forced = argValue('--id')
  if (forced) return forced

  const rows = await prisma.product.findMany({
    where: {
      OR: [
        { registrationStatus: 'registered' },
        { registrationStatus: 'pending' },
        { registrationStatus: null },
        { registrationStatus: '' },
      ],
      schedule: { not: null },
    },
    select: {
      id: true,
      title: true,
      country: true,
      schedule: true,
      registrationStatus: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  })

  // 일본·다거점 우선 (참고 프롬프트가 일본 스타일)
  const scored: Array<{ id: string; score: number; title: string; hubs: string }> = []
  for (const r of rows) {
    const schedule = parseScheduleJsonForRouteMap(r.schedule)
    const { hubs } = extractItineraryRouteMapHubs(schedule)
    const named = hubs.map((h) => String(h.cityKo ?? '').trim()).filter(Boolean)
    if (named.length < 2) continue
    const blob = `${r.title ?? ''} ${r.country ?? ''}`
    let score = named.length
    if (/일본|JAPAN|오사카|도쿄|교토|후쿠오카/i.test(blob)) score += 100
    scored.push({
      id: r.id,
      score,
      title: String(r.title ?? '').slice(0, 80),
      hubs: named.join('→'),
    })
  }
  scored.sort((a, b) => b.score - a.score)
  if (!scored[0]) throw new Error('샘플용 상품(거점≥2)을 찾지 못했습니다.')
  console.log('[sample] pick', scored[0])
  return scored[0].id
}

async function main() {
  const persist = argFlag('--persist')
  const productId = await pickSampleId()

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      country: true,
      destination: true,
      primaryDestination: true,
      schedule: true,
      registrationStatus: true,
    },
  })
  if (!product) throw new Error('product not found')

  const schedule = parseScheduleJsonForRouteMap(product.schedule)
  const { hubs, legs } = extractItineraryRouteMapHubs(schedule)
  const { countryKo, countryEn } = resolveItineraryRouteMapCountry({
    country: product.country,
    destination: product.destination,
    primaryDestination: product.primaryDestination,
    title: product.title,
  })
  const prompt = buildItineraryRouteMapPrompt({ countryKo, countryEn, hubs, legs })

  console.log('[sample] model=', IMAGEN_MODEL)
  console.log('[sample] product=', product.id, product.registrationStatus, product.title)
  console.log('[sample] hubs=', hubs.map((h) => `${h.cityKo}(${h.dayLabel})`).join(' → '))
  console.log('[sample] promptPreview=\n', prompt.slice(0, 600), '...\n')

  const buffer = await generateImageWithGemini({
    prompt,
    aspectRatio: '4:3',
    stylePreset: 'flat_itinerary_map',
    strictErrors: true,
  })
  if (!buffer) throw new Error('image generation returned null')

  const webp = await convertToWebp(buffer, { quality: 86 })
  const outDir = path.join(process.cwd(), 'tmp')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `itinerary-route-map-sample-${product.id}.webp`)
  fs.writeFileSync(outPath, webp.buffer)
  console.log('[sample] wrote', outPath, 'bytes=', webp.buffer.length, `${webp.width}x${webp.height}`)

  if (persist) {
    const result = await generateAndPersistItineraryRouteMap(prisma, product.id, { force: true })
    console.log('[sample] persist', result)
  } else {
    console.log('[sample] DB 미저장 (확인 후 --persist 로 1건만 반영)')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
