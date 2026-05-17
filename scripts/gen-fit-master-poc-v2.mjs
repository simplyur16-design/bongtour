/**
 * PoC v2: 가오승 4일 FIT 마스터 — 강화 프롬프트 + transportDuration +15% 안전마진.
 * Usage: node scripts/gen-fit-master-poc-v2.mjs
 * v1 출력(kaohsiung-4d-{persona}.json)은 비교용으로 보존.
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
const COST_NOTE_REQUIRED = '현지 실제 가격은 다를 수 있음'

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
  const personaBlock =
    persona === 'couple'
      ? `couple
  - couple = 커플. 야경·카페·로컬 맛집·로맨틱한 스팟 중심. **Day별 활동 7개 이내. 09:00~20:00 권장. 12시간 강행군 금지.**`
      : `with-parents
  - with-parents = 부모와 함께. 편안한 일정·유명 관광지·한식당 포함·이동 부담 적게.`

  return `당신은 봉투어의 자유여행(에어텔) 예시 일정 작성 전문가입니다.
한국인 고객 대상, 따뜻하고 친근한 한국어로 작성하세요.

[컨텍스트]
- 도시: 대만 가오슝 (Kaohsiung, 高雄)
- 일정: 3박 4일 (totalDays=4)
- 페르소나: ${personaBlock}
- 공항: 가오슝 국제공항(KHH)
- 호텔: 가오슝 시내 4성급 (체크인 15:00 / 체크아웃 11:00)
- 자유여행 = 항공+호텔. 일정은 "예시" — 고객 참고용.
- 근교 이동: 편도 90분 이내. dayCityKey는 City SSOT 키만.
- 모든 estimatedCostNote에 "현지 실제 가격은 다를 수 있음" 포함.

[시간 정합성 — 가오슝 표준 소요시간]
반드시 아래 값 참고하여 transportDuration 산정. 환승 시 +5~10분 포함:
- 공항(KHH) → 시내 미려도역: MRT 紅선 27분, NT$35
- 공항 → 시내 택시: 25~30분, NT$300~400
- 시내 ↔ 보얼예술특구(駁二藝術特區): MRT 橘선 15분 / 도보 인접 20분
- 시내 ↔ 연지담 용호탑(蓮池潭): MRT 紅선 25분 환승 포함 / 택시 20분
- 시내 ↔ 치진섬: 구산 페리 10분, NT$30 1인 왕복
- 시내 ↔ 미려도역(美麗島): 시내 중심부
- 시내 ↔ 쇼우산 LOVE 전망대(壽山): 택시 15분
- 시내 ↔ 다궈 영국 영사관(打狗英國領事館): 택시 20분 (걸어가기 어려움)
- 시내 ↔ 한신 아레나(漢神巨蛋): MRT 橘선 20분

야시장 시내/외곽 구분 (필수 명시):
- 시내(걸어서 OK): 리우허 六合夜市 (시내 중심, 15분 이내)
- 외곽(MRT 환승 필요): 루이펑 瑞豐夜市 (좌영구, 30분+)

[음식 카테고리 강화 — meal activity description 작성 규칙]
다음 정보를 자연스럽게 포함:
- 식당명 (한글+한자/원어 병기, 예: 항원우육면 港園牛肉麵)
- 시그니처 메뉴 (현지 발음+한국어 의역, 예: 牛肉麵 우육면, 蝦肉小籠包 새우 샤오롱바오)
- 가격대 (NT$ + ₩ 환산, 예: NT$200(₩8,500) / 1인)
- 예약 필요 여부 (예: "딘타이펑 예약 추천", "노포라 워크인")
- 운영시간

예시 변환:
나쁜 예) "딤섬 점심"
좋은 예) "딘타이펑 가오슝 한신점(鼎泰豐 漢神巨蛋店). 시그니처는 蝦肉小籠包 새우 샤오롱바오 NT$220(₩9,500)/판. 예약 추천. 11:00~14:30/17:00~21:30"

[기념품 카테고리 강화 — shopping activity 작성 규칙]
단일 펑리수만 X. 2~3개 옵션 추천:
- 펑리수 4대 브랜드 (특성 비교): 펑라이거(老牌, 진한 식감) / SunnyHills(微熱山丘, 사과파이) / 이슌찬(義順軒) / 치아터(佳德, 가장 유명)
- 태양병 太陽餅
- 누가크래커 牛軋糖 餅乾
- 우롱차 (高山·阿里山)
- 일출케이크 日出
- Naruko·大眼娃娃 등 대만 화장품

장소 구분: 전문점(가장 맛있음·정통) vs 백화점(편리·다양) vs 공항면세(비쌈, 최후 옵션).

[장소 꿀팁 강화 — attraction activity description 작성 규칙]
다음 포함:
- 추천 시간대 (오전 햇빛 / 일몰 / 야간 조명)
- 사진 잘 나오는 포인트 (예: "용 꼬리 쪽 계단에서 탑 전체가 한 컷")
- 현지인 vs 관광객 (예: "관광객 대부분, 평일 오전이 한산")
- 주의사항 (휴무일·복장·소음·사진 가능 구역)

[일정 구조]
- Day 1: 도착일 (오후 도착, 호텔 체크인 후 가까운 야시장 또는 시내 산책)
- Day 2~3: 본격 관광 (Day별 6~9개 activity, couple은 7개 이내)
- Day 4: 귀국일 (오전~점심 + 공항 이동)

[표기 통일]
- 보얼예술특구(駁二藝術特區) — '보예'·'보어' 표기 X
- 식당·장소는 한글+한자/원어 병기 권장

[출력 형식]
**반드시 아래 JSON 스키마로만 출력. 마크다운 코드블록 없이. 설명 텍스트 금지. JSON 외 어떤 글자도 출력 금지.**

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
          "description": "위 강화 규칙 따라 상세 설명",
          "location": "장소명 또는 null",
          "startTime": "HH:MM",
          "durationMinutes": 60,
          "estimatedCostKrw": 15000,
          "estimatedCostNote": "...현지 실제 가격은 다를 수 있음",
          "transportMode": "MRT 또는 도보 등 또는 null",
          "transportDuration": "27분 또는 null",
          "transportCostKrw": 1500
        }
      ]
    }
  ]
}

category 허용값: transport / hotel / meal / attraction / shopping / tip / leisure`
}

const USER_PROMPT =
  '위 v2 지침에 따라 가오슝 3박 4일 자유여행 예시 일정 JSON을 생성하세요. days는 정확히 4개. Day 2~3은 activities 6~9개(couple은 Day별 7개 이내). Day 1·4는 activities 최소 3개. meal·shopping·attraction description은 강화 규칙을 따르세요.'

function applySafetyMargin(itinerary) {
  let count = 0
  for (const day of itinerary.days) {
    for (const activity of day.activities) {
      if (activity.transportDuration && typeof activity.transportDuration === 'string') {
        const m = activity.transportDuration.match(/(\d+)\s*분/)
        if (m) {
          const original = parseInt(m[1], 10)
          const adjusted = Math.ceil(original * 1.15)
          activity.transportDurationOriginal = activity.transportDuration
          activity.transportDuration = `${adjusted}분`
          count++
        }
      }
    }
  }
  return count
}

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
  let coupleDay2Count = null

  if (!Array.isArray(days)) {
    errors.push('days is not an array')
    return { ok: false, errors, coupleDay2Count, safetyMarginCount: 0 }
  }
  if (days.length !== TOTAL_DAYS) {
    errors.push(`days.length === ${days.length} (expected ${TOTAL_DAYS})`)
  }

  const badCategories = []
  const missingCostNotes = []

  for (const day of days) {
    const activities = day?.activities
    const dayNum = day?.dayNumber
    if (!Array.isArray(activities)) {
      errors.push(`day ${dayNum ?? '?'}: activities missing`)
      continue
    }
    if (activities.length < 3) {
      errors.push(`day ${dayNum ?? '?'}: activities.length === ${activities.length} (< 3)`)
    }
    if (persona === 'couple' && dayNum === 2) {
      coupleDay2Count = activities.length
      if (activities.length > 7) {
        errors.push(`couple Day 2: activities.length === ${activities.length} (> 7)`)
      }
    }
    for (const act of activities) {
      const cat = act?.category
      if (!ALLOWED_CATEGORIES.has(cat)) {
        badCategories.push({ day: dayNum, order: act?.order, category: cat })
      }
      const note = act?.estimatedCostNote
      if (typeof note !== 'string' || !note.includes(COST_NOTE_REQUIRED)) {
        missingCostNotes.push({ day: dayNum, order: act?.order, title: act?.title })
      }
    }
  }

  if (badCategories.length > 0) {
    errors.push(
      `invalid category: ${badCategories.map((b) => `day${b.day}#${b.order}=${JSON.stringify(b.category)}`).join(', ')}`
    )
  }
  if (missingCostNotes.length > 0) {
    errors.push(
      `estimatedCostNote missing "${COST_NOTE_REQUIRED}": ${missingCostNotes.length} activity(ies) (e.g. day${missingCostNotes[0].day}#${missingCostNotes[0].order})`
    )
  }

  return { ok: errors.length === 0, errors, coupleDay2Count }
}

function printValidation(persona, filePath, result, safetyMarginCount) {
  console.log(`\n=== ${persona} (v2) ===`)
  console.log(`file: ${filePath}`)
  console.log(`safety margin applied: ${safetyMarginCount} transportDuration(s)`)
  if (persona === 'couple' && result.coupleDay2Count != null) {
    console.log(`couple Day 2 activities: ${result.coupleDay2Count} (max 7)`)
  }
  if (result.ok) {
    console.log('validation: PASS')
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
  console.log(`output: ${OUT_DIR} (*-v2.json)`)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const genAI = new GoogleGenerativeAI(apiKey)

  const summary = []

  for (const persona of PERSONAS) {
    console.log(`\nGenerating v2: ${persona}...`)
    const data = await generateForPersona(genAI, modelName, persona)
    const safetyMarginCount = applySafetyMargin(data)
    const filePath = path.join(OUT_DIR, `kaohsiung-4d-${persona}-v2.json`)
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    const validation = validatePayload(data, persona)
    printValidation(persona, filePath, validation, safetyMarginCount)
    summary.push({ persona, filePath, validation, safetyMarginCount })
  }

  console.log('\n--- v2 summary ---')
  for (const { persona, filePath, validation, safetyMarginCount } of summary) {
    const day2 =
      persona === 'couple' && validation.coupleDay2Count != null
        ? `, Day2=${validation.coupleDay2Count} acts`
        : ''
    console.log(
      `${persona}: ${filePath} → ${validation.ok ? 'PASS' : 'FAIL'} (margin: ${safetyMarginCount}${day2})`
    )
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e)
  process.exit(1)
})
