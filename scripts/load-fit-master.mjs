/**
 * PoC FIT JSON → FitItineraryMaster / Day / Activity / Validation DB 적재.
 * Usage: node scripts/load-fit-master.mjs <json_path>
 * Example: node scripts/load-fit-master.mjs gemini-poc-output/kaohsiung-4d-couple-v2.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../prisma-gen-runtime/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const COUNTRY_CODE = {
  japan: 'JP',
  taiwan: 'TW',
  singapore: 'SG',
  hongkong: 'HK',
  macau: 'MO',
  malaysia: 'MY',
  vietnam: 'VN',
  indonesia: 'ID',
  thailand: 'TH',
  philippines: 'PH',
}

const VALIDATION_STATUS = 'verified'
const VALIDATION_SEARCH_QUERY = 'manual_review_claude'

function loadEnvFiles() {
  for (const name of ['.env', '.env.local']) {
    const p = path.join(ROOT, name)
    if (!fs.existsSync(p)) continue
    const raw = fs.readFileSync(p, 'utf8')
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (name === '.env.local' || process.env[k] == null || process.env[k] === '') {
        process.env[k] = v
      }
    }
  }
}

/**
 * @param {string} filename e.g. kaohsiung-4d-couple-v2.json
 */
function parseFilename(filename) {
  const base = path.basename(filename)
  const m = base.match(/^(.+)-(\d+)d-([a-z0-9-]+?)(?:-v\d+)?\.json$/i)
  if (!m) {
    throw new Error(
      `파일명 파싱 실패: "${base}" — 패턴 {cityKey}-{N}d-{persona}(-vN)?.json 필요 (예: kaohsiung-4d-couple-v2.json)`
    )
  }
  return {
    cityKey: m[1],
    totalDays: Number.parseInt(m[2], 10),
    persona: m[3],
  }
}

function resolveCountryCode(countryKey) {
  const code = COUNTRY_CODE[countryKey]
  if (!code) {
    throw new Error(
      `countryCode 매핑 없음: countryKey="${countryKey}". COUNTRY_CODE에 항목을 추가하세요.`
    )
  }
  return code
}

function activityCreateData(act) {
  return {
    order: act.order,
    category: act.category,
    title: act.title,
    description: act.description ?? null,
    location: act.location ?? null,
    locationLat: act.locationLat ?? null,
    locationLng: act.locationLng ?? null,
    locationUrl: act.locationUrl ?? null,
    startTime: act.startTime ?? null,
    durationMinutes: act.durationMinutes ?? null,
    estimatedCostKrw: act.estimatedCostKrw ?? null,
    estimatedCostNote: act.estimatedCostNote ?? null,
    transportMode: act.transportMode ?? null,
    transportDuration: act.transportDuration ?? null,
    transportCostKrw: act.transportCostKrw ?? null,
  }
}

async function main() {
  const jsonArg = process.argv[2]
  if (!jsonArg?.trim()) {
    console.error('Usage: node scripts/load-fit-master.mjs <json_path>')
    process.exit(1)
  }

  loadEnvFiles()

  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[load-fit-master] DATABASE_URL 미설정 (.env / .env.local)')
    process.exit(1)
  }

  const jsonPath = path.isAbsolute(jsonArg) ? jsonArg : path.join(process.cwd(), jsonArg)
  if (!fs.existsSync(jsonPath)) {
    console.error(`[load-fit-master] JSON 파일 없음: ${jsonPath}`)
    process.exit(1)
  }

  let payload
  try {
    payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  } catch (e) {
    console.error(`[load-fit-master] JSON 파싱 실패: ${e instanceof Error ? e.message : e}`)
    process.exit(1)
  }

  const { cityKey, totalDays, persona } = parseFilename(jsonPath)
  console.log(`[load-fit-master] file=${path.basename(jsonPath)} cityKey=${cityKey} totalDays=${totalDays} persona=${persona}`)

  const prisma = new PrismaClient()

  try {
    const city = await prisma.city.findUnique({
      where: { cityKey },
      select: { cityKey: true, koreanLabel: true, countryKey: true },
    })
    if (!city) {
      throw new Error(`City SSOT에 cityKey="${cityKey}" 없음`)
    }

    const countryCode = resolveCountryCode(city.countryKey)
    console.log(`[load-fit-master] cityNameKo=${city.koreanLabel} countryKey=${city.countryKey} countryCode=${countryCode}`)

    const existing = await prisma.fitItineraryMaster.findUnique({
      where: {
        cityKey_persona_totalDays: { cityKey, persona, totalDays },
      },
      select: { id: true },
    })

    if (existing) {
      console.log(
        `[load-fit-master] SKIP — 이미 존재: master.id=${existing.id} (${cityKey}, ${persona}, ${totalDays}일)`
      )
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
          cityKey,
          cityNameKo: city.koreanLabel,
          countryCode,
          persona,
          totalDays,
          title: String(payload.title ?? `${city.koreanLabel} ${totalDays}일 ${persona}`),
          summary: payload.summary ?? null,
          generatedBy: 'gemini',
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
            dayCityKey: day.dayCityKey ?? null,
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

    console.log('[load-fit-master] OK')
    console.log(`  master.id: ${result.master.id}`)
    console.log(`  cityKey: ${cityKey}`)
    console.log(`  persona: ${persona}`)
    console.log(`  days: ${result.dayCount}`)
    console.log(`  activities: ${result.activityCount}`)
    console.log(`  validations: ${result.validationCount}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[load-fit-master] FAILED: ${msg}`)
    if (e instanceof Error && e.stack) console.error(e.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
