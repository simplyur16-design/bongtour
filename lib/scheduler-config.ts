import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'

export type SchedulerConfig = {
  cronHour: number
  cronMinute: number
  /** 등록완료 상품 ProductDeparture 재수집 기준(시간). 운영 기본 24h */
  departuresIntervalHours: number
  /** 출발 임박(예: 14일) 상품은 운영에서 2~4회/일 상향 */
  urgentDepartureWindowDays: number
  /** ItineraryDay 재수집 기준(일). 운영 기본 2일 */
  itineraryIntervalDays: number
  restMin: number
  restMax: number
  randomizeUserAgent: boolean
  randomMouseMovement: boolean
  headlessMode: boolean
}

const DEFAULT: SchedulerConfig = {
  cronHour: 12,
  cronMinute: 30,
  departuresIntervalHours: 24,
  urgentDepartureWindowDays: 14,
  itineraryIntervalDays: 2,
  restMin: 30,
  restMax: 90,
  randomizeUserAgent: true,
  randomMouseMovement: false,
  headlessMode: true,
}

const CONFIG_DIR = process.env.SCHEDULER_CONFIG_DIR || path.join(process.cwd(), 'data')
const CONFIG_PATH = path.join(CONFIG_DIR, 'scheduler-config.json')

function ensureDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

export function getSchedulerConfig(): SchedulerConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<SchedulerConfig>
      return {
        cronHour: typeof parsed.cronHour === 'number' ? parsed.cronHour : DEFAULT.cronHour,
        cronMinute: typeof parsed.cronMinute === 'number' ? parsed.cronMinute : DEFAULT.cronMinute,
        departuresIntervalHours:
          typeof parsed.departuresIntervalHours === 'number'
            ? parsed.departuresIntervalHours
            : DEFAULT.departuresIntervalHours,
        urgentDepartureWindowDays:
          typeof parsed.urgentDepartureWindowDays === 'number'
            ? parsed.urgentDepartureWindowDays
            : DEFAULT.urgentDepartureWindowDays,
        itineraryIntervalDays:
          typeof parsed.itineraryIntervalDays === 'number'
            ? parsed.itineraryIntervalDays
            : DEFAULT.itineraryIntervalDays,
        restMin: typeof parsed.restMin === 'number' ? parsed.restMin : DEFAULT.restMin,
        restMax: typeof parsed.restMax === 'number' ? parsed.restMax : DEFAULT.restMax,
        randomizeUserAgent: typeof parsed.randomizeUserAgent === 'boolean' ? parsed.randomizeUserAgent : DEFAULT.randomizeUserAgent,
        randomMouseMovement: typeof parsed.randomMouseMovement === 'boolean' ? parsed.randomMouseMovement : DEFAULT.randomMouseMovement,
        headlessMode: typeof parsed.headlessMode === 'boolean' ? parsed.headlessMode : DEFAULT.headlessMode,
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT }
}

export function setSchedulerConfig(config: Partial<SchedulerConfig>): SchedulerConfig {
  ensureDir()
  const current = getSchedulerConfig()
  const next: SchedulerConfig = {
    cronHour: typeof config.cronHour === 'number' ? config.cronHour : current.cronHour,
    cronMinute: typeof config.cronMinute === 'number' ? config.cronMinute : current.cronMinute,
    departuresIntervalHours:
      typeof config.departuresIntervalHours === 'number'
        ? config.departuresIntervalHours
        : current.departuresIntervalHours,
    urgentDepartureWindowDays:
      typeof config.urgentDepartureWindowDays === 'number'
        ? config.urgentDepartureWindowDays
        : current.urgentDepartureWindowDays,
    itineraryIntervalDays:
      typeof config.itineraryIntervalDays === 'number'
        ? config.itineraryIntervalDays
        : current.itineraryIntervalDays,
    restMin: typeof config.restMin === 'number' ? config.restMin : current.restMin,
    restMax: typeof config.restMax === 'number' ? config.restMax : current.restMax,
    randomizeUserAgent: typeof config.randomizeUserAgent === 'boolean' ? config.randomizeUserAgent : current.randomizeUserAgent,
    randomMouseMovement: typeof config.randomMouseMovement === 'boolean' ? config.randomMouseMovement : current.randomMouseMovement,
    headlessMode: typeof config.headlessMode === 'boolean' ? config.headlessMode : current.headlessMode,
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf-8')
  return next
}

/** run-once spawn 시 전달할 env 오버레이 */
export function getSchedulerEnvOverrides(): Record<string, string> {
  const c = getSchedulerConfig()
  return {
    SCHEDULER_HOUR: String(c.cronHour),
    SCHEDULER_MINUTE: String(c.cronMinute),
    DEPARTURES_INTERVAL_HOURS: String(c.departuresIntervalHours),
    URGENT_DEPARTURE_WINDOW_DAYS: String(c.urgentDepartureWindowDays),
    ITINERARY_INTERVAL_DAYS: String(c.itineraryIntervalDays),
    SCHEDULER_REST_MIN: String(c.restMin),
    SCHEDULER_REST_MAX: String(c.restMax),
    RANDOMIZE_UA: c.randomizeUserAgent ? '1' : '0',
    RANDOM_MOUSE: c.randomMouseMovement ? '1' : '0',
    HEADLESS: c.headlessMode ? '1' : '0',
  }
}
