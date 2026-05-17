/**
 * FIT 일정 PoC — gen/load 스크립트 공용 (ESM).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../prisma-gen-runtime/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.join(__dirname, '..')
export const OUT_DIR = path.join(ROOT, 'gemini-poc-output')

export const COUNTRY_CODE = {
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

export const ALLOWED_CATEGORIES = new Set([
  'transport',
  'hotel',
  'meal',
  'attraction',
  'shopping',
  'tip',
  'leisure',
])

export const COST_NOTE_REQUIRED = '현지 실제 가격은 다를 수 있음'

/** @returns {PrismaClient} */
export function getPrisma() {
  if (!globalThis.prisma) {
    globalThis.prisma = new PrismaClient()
  }
  return globalThis.prisma
}

export function loadEnvFiles() {
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

export function resolveCountryCode(countryKey) {
  const code = COUNTRY_CODE[countryKey]
  if (!code) {
    throw new Error(`countryCode 매핑 없음: countryKey="${countryKey}"`)
  }
  return code
}

export function parseTotalDays(duration, tripDays) {
  if (tripDays != null && Number.isFinite(tripDays) && tripDays > 0) {
    return Math.round(tripDays)
  }
  const raw = (duration ?? '').replace(/\s+/g, '')
  const m = raw.match(/(\d+)박(\d+)일/)
  if (m) return Number.parseInt(m[2], 10)
  const m2 = raw.match(/(\d+)일/)
  if (m2) return Number.parseInt(m2[1], 10)
  throw new Error(`duration 파싱 실패: "${duration ?? ''}" (tripDays=${tripDays})`)
}

export function parseFirstHotelName(hotelText) {
  if (!hotelText?.trim()) return '시내 4성급 호텔'
  const first = hotelText.split(/[,·\n]/)[0].trim()
  const m = first.match(/^(.+?)\s*외\s*\d+\s*개/)
  return (m ? m[1] : first).trim()
}

/** DateTime → HH:MM (날짜 무시) */
export function formatTimeHHMM(value) {
  if (value == null) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function applySafetyMargin(itinerary) {
  let count = 0
  for (const day of itinerary.days ?? []) {
    for (const activity of day.activities ?? []) {
      if (activity.transportDuration && typeof activity.transportDuration === 'string') {
        const m = activity.transportDuration.match(/(\d+)\s*분/)
        if (m) {
          const original = Number.parseInt(m[1], 10)
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

export function parseJsonFromText(text) {
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

export function validateItineraryPayload(data, expectedDays) {
  const errors = []
  const days = data?.days

  if (!Array.isArray(days)) {
    errors.push('days is not an array')
    return { ok: false, errors }
  }
  if (days.length !== expectedDays) {
    errors.push(`days.length === ${days.length} (expected ${expectedDays})`)
  }

  const badCategories = []
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
    for (const act of activities) {
      if (!ALLOWED_CATEGORIES.has(act?.category)) {
        badCategories.push({ day: dayNum, order: act?.order, category: act?.category })
      }
    }
  }

  if (badCategories.length > 0) {
    errors.push(
      `invalid category: ${badCategories.map((b) => `day${b.day}#${b.order}=${JSON.stringify(b.category)}`).join(', ')}`
    )
  }

  return { ok: errors.length === 0, errors }
}

export function activityCreateData(act) {
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

export function buildV2SharedPromptSections(cityKey, totalDays) {
  const kaohsiungTimes =
    cityKey === 'kaohsiung'
      ? `[가오슝 표준 소요시간 — cityKey=kaohsiung]
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
- 외곽(MRT 환승 필요): 루이펑 瑞豐夜市 (좌영구, 30분+)`
      : `[다른 도시 — cityKey=${cityKey}]
해당 도시의 일반적 대중교통 표준시간 + 환승 +5~10분 + 시내/외곽 구분 명시. 학습 데이터 기반.`

  return `
[시간 정합성]
${kaohsiungTimes}

- 근교 이동: 편도 90분 이내. dayCityKey는 City SSOT 키만.
- 모든 estimatedCostNote에 "현지 실제 가격은 다를 수 있음" 포함.

[음식 카테고리 강화 — meal activity description 작성 규칙]
다음 정보를 자연스럽게 포함:
- 식당명 (한글+한자/원어 병기)
- 시그니처 메뉴 (현지 발음+한국어 의역)
- 가격대 (NT$/JP¥ + ₩ 환산)
- 예약 필요 여부, 운영시간

[기념품 카테고리 강화 — shopping activity 작성 규칙]
단일 품목만 X. 2~3개 옵션 추천. 도시·국가에 맞는 기념품:
- 일본: 시로이코이비토·로이스·도쿄바나나·말차·일본 화장품·럭키캣 등
- 대만: 펑리수 4대 브랜드(펑라이거/SunnyHills/이슌찬/佳德) 비교, 태양병·牛軋糖·우롱차·日出 등
- 싱가포르: 카야잼·머라이언·TWG 차·부엉이 커피 등
- 베트남: 쌀국수 키트·라이스페이퍼·코끼리 견과·노이바이 라운지 등
장소 구분: 전문점 vs 백화점 vs 공항면세.

[장소 꿀팁 강화 — attraction activity description 작성 규칙]
추천 시간대, 사진 포인트, 현지인 vs 관광객, 주의사항 포함.

[일정 구조]
- Day 1: 도착일 (항공 도착 시각에 맞춤)
- Day 2~${Math.max(2, totalDays - 1)}: 본격 관광 (Day별 6~9개 activity)
- Day ${totalDays}: 귀국일 (항공 출발 시각에 맞춤)

[표기 통일]
- 보얼예술특구(駁二藝術特區), 싱룽쥐(興隆居) 등 봉투어 한글 SSOT
- 식당·장소는 한글+한자/원어 병기 권장

[출력 형식]
**반드시 아래 JSON 스키마로만 출력. 마크다운 코드블록 없이. 설명 텍스트 금지. JSON 외 어떤 글자도 출력 금지.**

{
  "title": "...",
  "summary": "...",
  "days": [
    {
      "dayNumber": 1,
      "title": "도착일",
      "summary": "Day 요약 한 문장",
      "dayCityKey": "${cityKey}",
      "activities": [
        {
          "order": 1,
          "category": "transport",
          "title": "활동 제목",
          "description": "상세 설명",
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
