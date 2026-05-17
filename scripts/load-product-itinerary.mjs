/**
 * product-{productId}-v3.json → FitItineraryMaster (productId UNIQUE) DB 적재.
 * Usage:
 *   node scripts/load-product-itinerary.mjs <productId>
 *   node scripts/load-product-itinerary.mjs gemini-poc-output/product-{productId}-v3.json
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  OUT_DIR,
  ROOT,
  activityCreateData,
  getPrisma,
  loadEnvFiles,
  parseTotalDays,
  resolveCountryCode,
} from './fit-itinerary-shared.mjs'

const VALIDATION_STATUS = 'verified'
const VALIDATION_SEARCH_QUERY = 'manual_review_claude'
const PERSONA_MIXED = 'mixed'

function resolveInput(arg) {
  const trimmed = arg.trim()
  const base = path.basename(trimmed)
  const fromFile = base.match(/^product-(.+)-v\d+\.json$/i)
  if (fromFile || trimmed.endsWith('.json')) {
    const jsonPath = path.isAbsolute(trimmed) ? trimmed : path.join(process.cwd(), trimmed)
    const productId = fromFile?.[1]
    if (!productId) {
      throw new Error(`파일명에서 productId 추출 실패: ${base}`)
    }
    return { productId, jsonPath }
  }
  const productId = trimmed
  const jsonPath = path.join(OUT_DIR, `product-${productId}-v3.json`)
  return { productId, jsonPath }
}

async function main() {
  const arg = process.argv[2]
  if (!arg?.trim()) {
    console.error('Usage: node scripts/load-product-itinerary.mjs <productId|json_path>')
    process.exitCode = 1
    return
  }

  loadEnvFiles()

  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[load-product-itinerary] DATABASE_URL 미설정')
    process.exitCode = 1
    return
  }

  let productId
  let jsonPath
  try {
    ;({ productId, jsonPath } = resolveInput(arg))
  } catch (e) {
    console.error(`[load-product-itinerary] ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
    return
  }

  if (!fs.existsSync(jsonPath)) {
    console.error(`[load-product-itinerary] JSON 없음: ${jsonPath}`)
    console.error(`  먼저: node scripts/gen-product-itinerary-v3.mjs ${productId}`)
    process.exitCode = 1
    return
  }

  let payload
  try {
    payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  } catch (e) {
    console.error(`[load-product-itinerary] JSON 파싱 실패: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
    return
  }

  const prisma = getPrisma()

  const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        cityKey: true,
        duration: true,
        tripDays: true,
        personaLabels: true,
      },
    })
    if (!product) {
      throw new Error(`Product 없음: id=${productId}`)
    }
    if (!product.cityKey?.trim()) {
      throw new Error(`Product.cityKey 없음`)
    }

    const city = await prisma.city.findUnique({
      where: { cityKey: product.cityKey },
      select: { cityKey: true, koreanLabel: true, countryKey: true },
    })
    if (!city) {
      throw new Error(`City SSOT에 cityKey="${product.cityKey}" 없음`)
    }

    const countryCode = resolveCountryCode(city.countryKey)
    const totalDays = parseTotalDays(product.duration, product.tripDays)

    console.log(
      `[load-product-itinerary] productId=${productId} cityKey=${city.cityKey} persona=${PERSONA_MIXED} totalDays=${totalDays}`
    )
    console.log(`  json: ${path.relative(ROOT, jsonPath)}`)

    const existing = await prisma.fitItineraryMaster.findUnique({
      where: { productId },
      select: { id: true },
    })

    if (existing) {
      console.log(`[load-product-itinerary] SKIP — 이미 존재: master.id=${existing.id} (productId=${productId})`)
      return
    }

    const days = payload.days
    if (!Array.isArray(days) || days.length === 0) {
      throw new Error('JSON days 배열이 비어 있음')
    }

    const now = new Date()
    const result = await prisma.$transaction(async (tx) => {
      const master = await tx.fitItineraryMaster.create({
        data: {
          productId,
          cityKey: city.cityKey,
          cityNameKo: city.koreanLabel,
          countryCode,
          persona: PERSONA_MIXED,
          totalDays,
          title: String(payload.title ?? `${city.koreanLabel} ${totalDays}일`),
          summary: payload.summary ?? null,
          generatedBy: 'gemini-v3',
          status: 'published',
          publishedAt: now,
        },
      })

      let dayCount = 0
      let activityCount = 0
      let validationCount = 0

      for (const day of days) {
        const createdDay = await tx.fitItineraryDay.create({
          data: {
            masterId: master.id,
            dayNumber: day.dayNumber,
            title: day.title,
            summary: day.summary ?? null,
            dayCityKey: day.dayCityKey ?? city.cityKey,
          },
        })
        dayCount++

        const activities = Array.isArray(day.activities) ? [...day.activities] : []
        activities.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

        for (const act of activities) {
          const createdActivity = await tx.fitItineraryActivity.create({
            data: {
              dayId: createdDay.id,
              ...activityCreateData(act),
            },
          })
          activityCount++

          await tx.fitItineraryActivityValidation.create({
            data: {
              activityId: createdActivity.id,
              status: VALIDATION_STATUS,
              searchQuery: VALIDATION_SEARCH_QUERY,
              checkedAt: now,
            },
          })
          validationCount++
        }
      }

      return { master, dayCount, activityCount, validationCount }
    })

    console.log('[load-product-itinerary] OK')
    console.log(`  master.id: ${result.master.id}`)
    console.log(`  productId: ${productId}`)
    console.log(`  days: ${result.dayCount}`)
    console.log(`  activities: ${result.activityCount}`)
  console.log(`  validations: ${result.validationCount}`)
}

main()
  .catch((err) => {
    const msg = err instanceof Error ? err.message : err
    console.error(`[load-product-itinerary] FAILED: ${msg}`)
    if (err instanceof Error && err.stack) console.error(err.stack)
    process.exitCode = 1
  })
  .finally(async () => {
    if (globalThis.prisma) {
      await globalThis.prisma.$disconnect()
    }
    process.exit(process.exitCode ?? 0)
  })
