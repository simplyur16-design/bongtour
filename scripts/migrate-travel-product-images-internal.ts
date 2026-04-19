/**
 * 여행상품 관련 필드의 외부 http(s) 이미지 URL을 Supabase(PhotoPool 경로)로 이관한다.
 * - Product.schedule (`rehostPexelsUrlsInScheduleEntries` → 행별 PhotoPool)
 * - Product.bgImageUrl, ItineraryDay.heroImageBundle, DestinationImageSet → PhotoPool만
 *
 * 로그(재실행 시 덮어씀):
 * - tmp-migrate-travel-images.log (전체)
 * - tmp-migrate-travel-images-success.log
 * - tmp-migrate-travel-images-fail.log
 *
 * `--apply` 없으면 dry-run(DB 미변경). `--dry-run`은 명시용으로 같이 써도 됨.
 *
 * 루트에서 실행. `import './load-env-for-scripts'` 가 `.env.local` / `.env` / `.env.production` 순으로 로드한다.
 *
 * npx tsx scripts/migrate-travel-product-images-internal.ts --dry-run --limit=30
 * npx tsx scripts/migrate-travel-product-images-internal.ts --apply --limit=30
 */
import './load-env-for-scripts'
import { appendFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { isObjectStorageConfigured } from '../lib/object-storage'
import { rehostPexelsUrlsInScheduleEntries, type ScheduleEntryRecord } from '../lib/schedule-day-image-rehost'
import {
  internalizeHeroDisplayUrl,
  internalizeProductCoverImageUrl,
  isExternalHttpProductImageUrl,
} from '../lib/travel-product-image-internalize'
import { extractPexelsPhotoIdFromCdnUrl } from '../lib/product-pexels-image-rehost'
import type { DayHeroImageBundle } from '../lib/itinerary-day-hero-image'

const LOG = join(process.cwd(), 'tmp-migrate-travel-images.log')
const LOG_OK = join(process.cwd(), 'tmp-migrate-travel-images-success.log')
const LOG_FAIL = join(process.cwd(), 'tmp-migrate-travel-images-fail.log')

function logLine(line: string) {
  const s = `[${new Date().toISOString()}] ${line}\n`
  process.stdout.write(s)
  try {
    appendFileSync(LOG, s)
  } catch {
    //
  }
}

function logOk(line: string) {
  const s = `[${new Date().toISOString()}] ${line}\n`
  try {
    appendFileSync(LOG_OK, s)
  } catch {
    //
  }
}

function logFail(line: string) {
  const s = `[${new Date().toISOString()}] ${line}\n`
  process.stderr.write(s)
  try {
    appendFileSync(LOG_FAIL, s)
  } catch {
    //
  }
}

function parseCli() {
  const apply = process.argv.includes('--apply')
  let limit = 500
  const limArg = process.argv.find((a) => a.startsWith('--limit='))
  if (limArg) {
    const n = Number(limArg.slice('--limit='.length))
    if (Number.isFinite(n) && n > 0) limit = Math.floor(n)
  }
  return { apply, limit }
}

function destinationLine(p: {
  primaryDestination: string | null
  destinationRaw: string | null
  destination: string | null
}): string {
  return (
    p.primaryDestination?.trim() ||
    p.destinationRaw?.trim() ||
    p.destination?.trim() ||
    'unknown'
  )
}

async function main() {
  const { apply, limit } = parseCli()
  writeFileSync(LOG, '')
  writeFileSync(LOG_OK, '')
  writeFileSync(LOG_FAIL, '')
  if (!isObjectStorageConfigured()) {
    logLine('ERROR: Supabase env missing')
    process.exit(1)
  }

  const products = await prisma.product.findMany({
    take: limit,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      schedule: true,
      bgImageUrl: true,
      primaryDestination: true,
      destinationRaw: true,
      destination: true,
    },
  })

  let scheduleTouched = 0
  let bgTouched = 0

  for (const p of products) {
    const dest = destinationLine(p)
    const cityFb = dest

    if (p.schedule) {
      let arr: ScheduleEntryRecord[]
      try {
        const parsed = JSON.parse(p.schedule) as unknown
        if (!Array.isArray(parsed)) continue
        arr = parsed as ScheduleEntryRecord[]
      } catch {
        continue
      }
      const needs = arr.some((row) => {
        const u = typeof row.imageUrl === 'string' ? row.imageUrl.trim() : ''
        return u && isExternalHttpProductImageUrl(u)
      })
      if (!needs) continue
      scheduleTouched++
      logLine(`${apply ? 'APPLY' : 'DRY'} schedule product=${p.id}`)
      if (!apply) {
        logOk(`DRY schedule product=${p.id}`)
        continue
      }
      const nextArr = await rehostPexelsUrlsInScheduleEntries(prisma, p.id, arr, (_day, row) => {
        const kw = typeof row.imageKeyword === 'string' ? String(row.imageKeyword).trim() : ''
        const placeGuess = kw ? kw.split(/[|,]/)[0]?.trim() || null : null
        return { placeName: placeGuess, cityName: cityFb, searchKeyword: kw || placeGuess || cityFb }
      })
      await prisma.product.update({
        where: { id: p.id },
        data: { schedule: JSON.stringify(nextArr) },
      })
      logOk(`OK schedule product=${p.id}`)
    }

    const bg = typeof p.bgImageUrl === 'string' ? p.bgImageUrl.trim() : ''
    if (bg && isExternalHttpProductImageUrl(bg)) {
      bgTouched++
      logLine(`${apply ? 'APPLY' : 'DRY'} bgImageUrl product=${p.id}`)
      if (!apply) {
        logOk(`DRY bgImageUrl product=${p.id}`)
        continue
      }
      try {
        const nextBg = await internalizeProductCoverImageUrl(prisma, {
          remoteUrl: bg,
          destination: dest,
          poolAttractionLabel: 'migrated_cover',
          poolSource: 'migrate',
          pexelsPhotoId: extractPexelsPhotoIdFromCdnUrl(bg),
          photographer: null,
          pexelsPageUrl: null,
          searchKeyword: 'migrate',
          placeName: null,
          cityName: cityFb.split(',')[0]?.trim() || cityFb,
        })
        await prisma.product.update({ where: { id: p.id }, data: { bgImageUrl: nextBg } })
        logOk(`OK bgImageUrl product=${p.id}`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        logLine(`FAIL bg product=${p.id} ${msg}`)
        logFail(`bg product=${p.id} ${msg}`)
      }
    }
  }

  const heroRows = await prisma.itineraryDay.findMany({
    take: limit,
    orderBy: [{ productId: 'desc' }, { day: 'desc' }],
    select: {
      id: true,
      productId: true,
      day: true,
      city: true,
      heroImageBundle: true,
      product: {
        select: { primaryDestination: true, destinationRaw: true, destination: true },
      },
    },
  })
  let heroTouched = 0
  for (const row of heroRows) {
    const raw = row.heroImageBundle
    if (!raw || typeof raw !== 'string') continue
    let bundle: DayHeroImageBundle
    try {
      bundle = JSON.parse(raw) as DayHeroImageBundle
    } catch {
      continue
    }
    const u = (bundle.heroImageUrl ?? '').trim()
    if (!u || !isExternalHttpProductImageUrl(u)) continue
    heroTouched++
    logLine(`${apply ? 'APPLY' : 'DRY'} hero itineraryDay=${row.id} product=${row.productId}`)
    if (!apply) {
      logOk(`DRY hero itineraryDay=${row.id} product=${row.productId}`)
      continue
    }
    const dest = destinationLine(row.product)
    const cityName = row.city?.trim() || dest.split(',')[0]?.trim() || null
    try {
      const nextUrl = await internalizeHeroDisplayUrl(prisma, {
        remoteUrl: u,
        destination: dest,
        attractionStem: bundle.heroPlaceQuery || bundle.heroPlaceName || `day_${row.day}`,
        pexelsPhotoId:
          bundle.heroImagePexelsId != null && bundle.heroImagePexelsId > 0
            ? bundle.heroImagePexelsId
            : extractPexelsPhotoIdFromCdnUrl(u),
        photographer: bundle.heroImagePhotographer,
        pexelsPageUrl: null,
        searchKeyword: bundle.heroPlaceQuery,
        placeName: bundle.heroPlaceName,
        cityName,
      })
      const nextBundle: DayHeroImageBundle = { ...bundle, heroImageUrl: nextUrl }
      await prisma.itineraryDay.update({
        where: { id: row.id },
        data: { heroImageBundle: JSON.stringify(nextBundle) },
      })
      logOk(`OK hero itineraryDay=${row.id} product=${row.productId}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logLine(`FAIL hero id=${row.id} ${msg}`)
      logFail(`hero itineraryDay=${row.id} product=${row.productId} ${msg}`)
    }
  }

  const destSets = await prisma.destinationImageSet.findMany({ take: limit, orderBy: { updatedAt: 'desc' } })
  let setTouched = 0
  for (const ds of destSets) {
    const destName = ds.destinationName.trim() || 'unknown'
    let mainDirty = false
    let slotsDirty = false
    let nextMain = ds.mainImageUrl
    let nextSchedJson = ds.scheduleImageUrls
    if (typeof nextMain === 'string' && isExternalHttpProductImageUrl(nextMain)) {
      setTouched++
      logLine(`${apply ? 'APPLY' : 'DRY'} destinationImageSet main ${ds.destinationName}`)
      if (!apply) {
        logOk(`DRY destinationImageSet main ${ds.destinationName}`)
      } else {
        try {
          nextMain = await internalizeProductCoverImageUrl(prisma, {
            remoteUrl: nextMain,
            destination: destName,
            poolAttractionLabel: 'destination_set_main',
            poolSource: 'destination-set',
            pexelsPhotoId: extractPexelsPhotoIdFromCdnUrl(nextMain),
            photographer: null,
            pexelsPageUrl: null,
            searchKeyword: destName,
            placeName: null,
            cityName: destName.split(',')[0]?.trim() || destName,
          })
          mainDirty = true
          logOk(`OK destinationImageSet main ${ds.destinationName}`)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          logLine(`FAIL destSet main ${ds.destinationName} ${msg}`)
          logFail(`destinationImageSet main ${ds.destinationName} ${msg}`)
        }
      }
    }
    const schedRaw = ds.scheduleImageUrls
    if (typeof schedRaw === 'string' && schedRaw.trim()) {
      try {
        const parsed = JSON.parse(schedRaw) as { url?: string }[]
        if (Array.isArray(parsed)) {
          const nextSlots: typeof parsed = []
          for (let i = 0; i < parsed.length; i++) {
            const item = parsed[i]
            const u0 = typeof item?.url === 'string' ? item.url.trim() : ''
            if (u0 && isExternalHttpProductImageUrl(u0)) {
              setTouched++
              logLine(`${apply ? 'APPLY' : 'DRY'} destinationImageSet slot ${ds.destinationName} #${i}`)
              if (!apply) {
                logOk(`DRY destinationImageSet slot ${ds.destinationName} #${i}`)
                nextSlots.push(item)
              } else {
                try {
                  const nu = await internalizeProductCoverImageUrl(prisma, {
                    remoteUrl: u0,
                    destination: destName,
                    poolAttractionLabel: `destination_set_${i}`,
                    poolSource: 'destination-set',
                    pexelsPhotoId: extractPexelsPhotoIdFromCdnUrl(u0),
                    photographer: null,
                    pexelsPageUrl: null,
                    searchKeyword: destName,
                    placeName: null,
                    cityName: destName,
                  })
                  nextSlots.push({ ...item, url: nu })
                  slotsDirty = true
                  logOk(`OK destinationImageSet slot ${ds.destinationName} #${i}`)
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e)
                  logLine(`FAIL destSet slot ${ds.destinationName} #${i} ${msg}`)
                  logFail(`destinationImageSet slot ${ds.destinationName} #${i} ${msg}`)
                  nextSlots.push(item)
                }
              }
            } else {
              nextSlots.push(item)
            }
          }
          if (apply && slotsDirty) nextSchedJson = JSON.stringify(nextSlots)
        }
      } catch {
        //
      }
    }
    if (apply && (mainDirty || slotsDirty)) {
      await prisma.destinationImageSet.update({
        where: { destinationName: ds.destinationName },
        data: { mainImageUrl: nextMain, scheduleImageUrls: nextSchedJson },
      })
    }
  }

  logLine(
    `Done. scheduleProducts=${scheduleTouched} bgProducts=${bgTouched} heroRows=${heroTouched} destSetOps=${setTouched} log=${LOG} success=${LOG_OK} fail=${LOG_FAIL}`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
