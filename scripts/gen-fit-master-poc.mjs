/**
 * PoC: 가오승 4일 FIT 마스터 일정 — Gemini JSON만 생성 (DB 저장 없음).
 * Usage: node scripts/gen-fit-master-poc.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleGenerativeAI } from '@google/generative-ai'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'gemini-poc-output')

const PERSONAS = ['couple', 'with-parents']
const ALLOWED_CATEGORIES = new Set([
  'transport',
  'hotel',
  'meal',
  'attraction',
  'shopping',
  'tip',
  'leisure',
])
const TOTAL_DAYS = 4

function loadEnvLocal() {
  const p = path.join(ROOT, '.env.local')
  if (!fs.existsSync(p)) return
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
    if (process.env[k] == null || process.env[k] === '') process.env[k] = v
  }
}

function buildSystemPrompt(persona) {
  const personaLines =
    persona === 'couple'
      ? `- 페르소나: couple
  - couple = 커플. 야경·카페·로컬 맛집·로맨틱한 스팟 중심.`
      : `- 페르소나: with-parents
  - with-parents = 부모와 함께. 편안한 일정·유명 관광지·한식당 포함·이동 부담 적게.`

  return `당신은 봉투어의 자유여행(에어텔) 예시 일정 작성 전문가입니다.
한국인 고객 대상, 따뜻하고 친근한 한국어로 작성하세요.

[컨텍스트]
- 도시: 대만 가오슝 (Kaohsiung, 高雄)
- 일정: 3박 4일 (totalDays=4)
${personaLines}
- 공항: 가오슝 국제공항(KHH)
- 호텔: 가오슝 시내 4성급 (체크인 15:00 / 체크아웃 11:00)
- 자유여행 = 항공+호텔만 봉투어가 제공. 일정은 "예시"로 고객 참고용.
- 근교 이동: 편도 90분 이내만 허용 (단수이지구 같은 멀리는 X). dayCityKey 사용 시 City SSOT에 있는 키만 사용 가능.
- 비용은 추정치. 모든 estimatedCostNote에 "현지 실제 가격은 다를 수 있음" 포함.

[일정 구조]
- Day 1: 도착일 (오후 도착 가정, 호텔 체크인 후 가까운 야시장 정도)
- Day 2~3: 본격 관광 (Day별 6~9개 activity)
- Day 4: 귀국일 (오전~점심 + 공항 이동)

[출력 형식]
**반드시 아래 JSON 스키마로만 출력. 마크다운 코드블록 사용 금지. 설명 텍스트 금지. JSON 외 어떤 글자도 출력 금지.**

{
  "title": "가오슝 4일 ${persona} 자유여행 예시",
  "summary": "한 문장 요약",
  "days": [
    {
      "dayNumber": 1,
      "title": "도착일",
      "summary": "Day 요약 한 문장",
      "dayCityKey": "kaohsiung",
      "activities": [
        {
          "order": 1,
          "category": "transport",
          "title": "활동 제목",
          "description": "상세 설명 1~2문장",
          "location": "장소명 또는 null",
          "startTime": "HH:MM",
          "durationMinutes": 60,
          "estimatedCostKrw": 15000,
          "estimatedCostNote": "클룩 기준 추정 / 현지 실제 가격은 다를 수 있음",
          "transportMode": "MRT 또는 도보 등 또는 null",
          "transportDuration": "20분 또는 null",
          "transportCostKrw": 800
        }
      ]
    }
  ]
}

category 허용값: transport / hotel / meal / attraction / shopping / tip / leisure
- transport: 공항-호텔 이동, MRT, 택시 등
- hotel: 체크인/체크아웃/호텔 휴식
- meal: 아침/점심/저녁/카페
- attraction: 관광지 방문
- shopping: 야시장/면세 등
- tip: 환전·심카드·여행 팁
- leisure: 마사지·온천·자유시간`
}

const USER_PROMPT =
  '위 지침에 따라 가오승 3박 4일 자유여행 예시 일정 JSON을 생성하세요. days는 정확히 4개, Day 2~3은 activities 6~9개, Day 1·4도 activities 최소 3개 이상.'

function parseJsonFromText(text) {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1].trim() : trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('JSON object not found in model response')
  }
  return JSON.parse(candidate.slice(start, end + 1))
}

function validatePayload(data, persona) {
  const errors = []
  const days = data?.days

  if (!Array.isArray(days)) {
    errors.push('days is not an array')
    return { ok: false, errors }
  }
  if (days.length !== TOTAL_DAYS) {
    errors.push(`days.length === ${days.length} (expected ${TOTAL_DAYS})`)
  }

  const badCategories = []
  for (const day of days) {
    const activities = day?.activities
    if (!Array.isArray(activities)) {
      errors.push(`day ${day?.dayNumber ?? '?'}: activities missing`)
      continue
    }
    if (activities.length < 3) {
      errors.push(`day ${day?.dayNumber ?? '?'}: activities.length === ${activities.length} (< 3)`)
    }
    for (const act of activities) {
      const cat = act?.category
      if (!ALLOWED_CATEGORIES.has(cat)) {
        badCategories.push({ day: day.dayNumber, order: act?.order, category: cat })
      }
    }
  }

  if (badCategories.length > 0) {
    errors.push(
      `invalid category values: ${badCategories.map((b) => `day${b.day}#${b.order}=${JSON.stringify(b.category)}`).join(', ')}`
    )
  }

  return { ok: errors.length === 0, errors, badCategories }
}

function printValidation(persona, filePath, result) {
  console.log(`\n=== ${persona} ===`)
  console.log(`file: ${filePath}`)
  if (result.ok) {
    console.log('validation: PASS')
    console.log(`  - days.length == ${TOTAL_DAYS}`)
    console.log('  - each day.activities.length >= 3')
    console.log('  - all activity.category in allowed enum')
  } else {
    console.log('validation: FAIL')
    for (const e of result.errors) console.log(`  - ${e}`)
  }
}

async function generateForPersona(genAI, modelName, persona) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: buildSystemPrompt(persona),
  })
  const res = await model.generateContent(USER_PROMPT, { timeout: 300_000 })
  const text = res.response.text()
  if (!text?.trim()) throw new Error('empty Gemini response')
  return parseJsonFromText(text)
}

async function main() {
  loadEnvLocal()

  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set (.env.local)')
    process.exit(1)
  }

  const modelName = (process.env.GEMINI_MODEL ?? 'gemini-2.5-flash').trim() || 'gemini-2.5-flash'
  console.log(`model: ${modelName}`)
  console.log(`output: ${OUT_DIR}`)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const genAI = new GoogleGenerativeAI(apiKey)

  const summary = []

  for (const persona of PERSONAS) {
    console.log(`\nGenerating: ${persona}...`)
    const data = await generateForPersona(genAI, modelName, persona)
    const filePath = path.join(OUT_DIR, `kaohsiung-4d-${persona}.json`)
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    const validation = validatePayload(data, persona)
    printValidation(persona, filePath, validation)
    summary.push({ persona, filePath, validation })
  }

  console.log('\n--- summary ---')
  for (const { persona, filePath, validation } of summary) {
    console.log(`${persona}: ${filePath} → ${validation.ok ? 'PASS' : 'FAIL'}`)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e)
  process.exit(1)
})
