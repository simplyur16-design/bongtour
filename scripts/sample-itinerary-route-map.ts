/**
 * 일정 동선 지도 샘플 1건 (코드 SVG, Gemini 없음).
 *
 *   npx tsx scripts/sample-itinerary-route-map.ts
 *   npx tsx scripts/sample-itinerary-route-map.ts --id=<productId>
 *   npx tsx scripts/sample-itinerary-route-map.ts --tag=osaka-kyoto
 *   npx tsx scripts/sample-itinerary-route-map.ts --persist
 */
import './load-env'
import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'
import { convertToWebp } from '../lib/image-to-webp'
import { resolveItineraryRouteMapCountry } from '../lib/itinerary-route-map-country'
import {
  extractItineraryRouteMapHubs,
  parseScheduleJsonForRouteMap,
} from '../lib/itinerary-route-map-hubs'
import { layoutItineraryRouteMapHubs } from '../lib/itinerary-route-map-layout'
import { renderItineraryRouteMapPng } from '../lib/itinerary-route-map-render-svg'
import { resolveRouteMapRegionId } from '../lib/itinerary-route-map-geo'
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

  const preferTag = argValue('--tag')
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

  const scored: Array<{ id: string; score: number; title: string; hubs: string }> = []
  for (const r of rows) {
    const schedule = parseScheduleJsonForRouteMap(r.schedule)
    const { hubs } = extractItineraryRouteMapHubs(schedule)
    const named = hubs.map((h) => String(h.cityKo ?? '').trim()).filter(Boolean)
    if (named.length < 2) continue
    const blob = `${r.title ?? ''} ${r.country ?? ''} ${named.join(' ')}`
    let score = named.length
    if (/일본|JAPAN|오사카|도쿄|교토|후쿠오카/i.test(blob)) score += 100
    if (preferTag === 'osaka-kyoto') {
      if (/오사카/.test(blob) && /교토/.test(blob)) score += 500
      if (named.length > 3) score -= 40
    }
    if (preferTag === 'danang-hoian') {
      if (/다낭|da nang/i.test(blob) && /호이안|hoi an/i.test(blob)) score += 500
      if (named.length > 3) score -= 40
    }
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
  const tag = argValue('--tag')
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
  const layout = layoutItineraryRouteMapHubs(hubs, { countryEn })
  const regionId = resolveRouteMapRegionId(hubs, countryEn)

  console.log('[sample] engine=svg_vector_2d')
  console.log('[sample] product=', product.id, product.registrationStatus, product.title)
  console.log('[sample] hubs=', hubs.map((h) => `${h.cityKo}(${h.dayLabel})`).join(' → '))
  console.log('[sample] region=', regionId, 'frame=', layout.frame, 'country=', countryKo)

  const png = await renderItineraryRouteMapPng({ hubs, legs, countryEn })
  const webp = await convertToWebp(png, { quality: 86 })
  const outDir = path.join(process.cwd(), 'tmp')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `itinerary-route-map-sample-${product.id}.webp`)
  const pngPath = path.join(outDir, `sample-${product.id}.png`)
  fs.writeFileSync(outPath, webp.buffer)
  fs.writeFileSync(pngPath, png)

  const desktop = path.join(process.env.HOME || '', 'Desktop')
  if (desktop && fs.existsSync(desktop)) {
    const nice =
      tag === 'osaka-kyoto'
        ? 'sample-osaka-kyoto.png'
        : tag === 'danang-hoian'
          ? 'sample-danang-hoian.png'
          : `sample-route-map-${product.id.slice(0, 8)}.png`
    const deskPath = path.join(desktop, nice)
    fs.writeFileSync(deskPath, png)
    fs.copyFileSync(pngPath, path.join(outDir, nice))
    console.log('[sample] desktop', deskPath)
  }

  console.log('[sample] wrote', outPath, pngPath, `${webp.width}x${webp.height}`)

  if (persist) {
    const result = await generateAndPersistItineraryRouteMap(prisma, product.id, { force: true })
    console.log('[sample] persist', result.ok ? result.meta.url : result)
  } else {
    console.log('[sample] DB 미저장 — --persist 로 1건 반영')
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
