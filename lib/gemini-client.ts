/**
 * 중앙 Gemini 클라이언트
 * - import: import { GoogleGenerativeAI } from "@google/generative-ai" 강제
 * - API 키: `GEMINI_API_KEY` 우선, 없으면 `GOOGLE_API_KEY` (Google AI Studio / 공식 예시와 동일)
 * - 기본 모델: `gemini-2.5-flash` (일반 키로 호출 가능). `GEMINI_MODEL=gemini-3-flash-preview` 등으로 덮어쓸 수 있음
 * - listModels 엔드포인트: v1 우선, 실패 시 v1beta
 */
import { GoogleGenerativeAI } from '@google/generative-ai'

const DEBUG = '[Bong투어-DEBUG]'

/**
 * Next.js 외부(node/tsx 등)에서 `.env`만 넘기고 `.env.local`을 안 읽으면 키가 비어 403이 난다.
 * 키가 비어 있을 때만 프로젝트 루트 `.env` → `.env.local` 순으로 파싱해 process.env에 채운다(.env.local이 우선).
 */
function bootstrapEnvFilesWhenKeyMissing(): void {
  if (typeof process === 'undefined' || !process.cwd) return
  const hasKey = () =>
    Boolean((process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim())
  if (hasKey()) return
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path')
    const root = process.cwd()
    for (const name of ['.env', '.env.local'] as const) {
      const p = path.join(root, name)
      if (!fs.existsSync(p)) continue
      const raw = fs.readFileSync(p, 'utf8')
      for (const line of raw.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq <= 0) continue
        const k = t.slice(0, eq).trim()
        if (!/^[\w.-]+$/.test(k)) continue
        let v = t.slice(eq + 1).trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        if (name === '.env.local') process.env[k] = v
        else if (process.env[k] === undefined) process.env[k] = v
      }
    }
  } catch {
    /* ignore: Edge 등에서 fs 불가 */
  }
}

bootstrapEnvFilesWhenKeyMissing()

const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
/** 일반 API 키로 호출 가능한 기본 Flash (3-preview는 키/프로그램 제한 시 403 가능) */
const MODEL_PRIMARY = 'gemini-2.5-flash'
/** 2.5 실패 시 */
const MODEL_FALLBACK = 'gemini-1.5-flash'

/** env 지정 시 그대로, 없으면 gemini-2.5-flash */
export const GEMINI_MODEL =
  process.env.GEMINI_MODEL || MODEL_PRIMARY

/** 연결 테스트(Hello World) — 짧게 실패 */
export const GEMINI_CONNECT_TIMEOUT_MS = Math.max(
  5_000,
  Number(process.env.GEMINI_CONNECT_TIMEOUT_MS) || 25_000
)
/**
 * generateContent 공통 타임아웃. `GEMINI_GENERATE_TIMEOUT_MS`로 재정의 가능.
 * 등록 파싱은 프롬프트·출력이 커서 SDK Abort가 잦아 기본 300초(환경변수로 조정).
 * (호출 측에서 별도 `AbortController` 등 클라이언트 타임아웃을 둘 수 있음)
 */
export const GEMINI_GENERATE_TIMEOUT_MS = Math.max(
  15_000,
  Number(process.env.GEMINI_GENERATE_TIMEOUT_MS) || 300_000
)

/** @google/generative-ai generateContent 두 번째 인자 */
export function geminiTimeoutOpts(ms: number = GEMINI_GENERATE_TIMEOUT_MS): { timeout: number } {
  return { timeout: ms }
}

/** listModels REST 호출 시 v1 우선, SDK는 패키지 기본 URL 사용 */
const API_VERSION_LIST = (process.env.GEMINI_API_VERSION || 'v1') as string

let _genAI: InstanceType<typeof GoogleGenerativeAI> | null = null
/** 연결 실패 시 fallback/오토스위칭으로 확정된 모델 */
let _resolvedModel: string | null = null

export function getGenAI(): InstanceType<typeof GoogleGenerativeAI> {
  if (!_genAI) {
    if (typeof GoogleGenerativeAI !== 'function') {
      console.error(`${DEBUG} GoogleGenerativeAI 로드 실패. typeof=${typeof GoogleGenerativeAI}`, GoogleGenerativeAI)
      throw new Error('GoogleGenerativeAI is not a constructor')
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${DEBUG} GoogleGenerativeAI 생성자 호출 직전 (정상 로드 확인됨)`)
    }
    _genAI = new GoogleGenerativeAI(apiKey)
  }
  return _genAI
}

/** 실제 사용할 모델명. fallback 적용 후에는 2.0-flash일 수 있음 */
export function getModelName(): string {
  return _resolvedModel ?? GEMINI_MODEL
}

/** 이미 연결 테스트로 모델이 확정되었으면 true (재요청 시 연결 테스트 생략용) */
export function isConnectionResolved(): boolean {
  return _resolvedModel != null
}

function isModelError(err: string): boolean {
  const lower = err.toLowerCase()
  return (
    lower.includes('404') ||
    lower.includes('403') ||
    lower.includes('forbidden') ||
    lower.includes('not found') ||
    lower.includes('invalid model') ||
    lower.includes('model')
  )
}

/** listModels(): v1 우선, 실패 시 v1beta. 가용 Flash 모델명 배열 반환 (오토 스위칭용) */
async function fetchAvailableFlashModels(): Promise<string[]> {
  if (!apiKey) return []
  const versions: string[] = [API_VERSION_LIST]
  if (API_VERSION_LIST !== 'v1beta') versions.push('v1beta')
  for (const ver of versions) {
    try {
      const url = `https://generativelanguage.googleapis.com/${ver}/models?key=${apiKey}`
      const res = await fetch(url)
      const data = (await res.json()) as { models?: Array<{ name?: string }> }
      const names = (data?.models ?? []).map((m) => (m?.name ?? '').replace(/^models\//, ''))
      const flash = names.filter((n) => n.toLowerCase().includes('flash'))
      console.log(`${DEBUG} listModels(${ver}) 가용 Flash:`, flash.length ? flash : names.slice(0, 15))
      return flash.length ? flash : names.slice(0, 10)
    } catch (e) {
      console.warn(`${DEBUG} listModels(${ver}) 조회 실패`, e instanceof Error ? e.stack : e)
    }
  }
  return []
}

/**
 * 상품 파싱 전 모델 연결 테스트. 404 시 listModels() 후 오토 스위칭.
 */
export async function testGeminiConnection(): Promise<{
  ok: boolean
  model: string
  apiVersion: string
  message?: string
  error?: string
}> {
  const result = {
    ok: false,
    model: '',
    apiVersion: API_VERSION_LIST,
    message: undefined as string | undefined,
    error: undefined as string | undefined,
  }
  if (!apiKey) {
    result.error = 'GEMINI_API_KEY or GOOGLE_API_KEY not set'
    result.model = GEMINI_MODEL
    console.warn(`${DEBUG} 모델 연결 실패:`, result.error)
    return result
  }

  /** 이미 성공한 모델이 있으면 매 요청마다 generateContent(Hello World) 반복하지 않음 — 체감 지연 주 원인 제거 */
  if (_resolvedModel) {
    result.ok = true
    result.model = _resolvedModel
    result.message = 'skipped (already resolved)'
    return result
  }

  const explicit = process.env.GEMINI_MODEL
  const useFallback = !explicit || explicit === MODEL_PRIMARY
  let toTry: string[] = useFallback
    ? [MODEL_PRIMARY, MODEL_FALLBACK, 'gemini-3-flash-preview']
    : [explicit!]

  for (let round = 0; round < 2; round++) {
    for (const modelName of toTry) {
      result.model = modelName
      try {
        console.log(`${DEBUG} 모델 연결 시도: ${modelName}`)
        const genAI = getGenAI()
        const model = genAI.getGenerativeModel({ model: modelName })
        const res = await model.generateContent('Reply with exactly: Hello World', {
          timeout: GEMINI_CONNECT_TIMEOUT_MS,
        })
        const text = res.response.text()?.trim() ?? ''
        result.ok = true
        result.message = text
        _resolvedModel = modelName
        console.log(`${DEBUG} 모델 연결 성공:`, { model: modelName, reply: text.slice(0, 80) })
        return result
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e)
        result.error = err
        console.error(`${DEBUG} 모델 연결 실패 (전체 스택):`, e instanceof Error ? e.stack : e)
        if (isModelError(err)) {
          const flashList = await fetchAvailableFlashModels()
          const next = flashList.find((m) => !toTry.includes(m))
          if (next && round === 0) {
            toTry = [...toTry, next]
            console.log(`${DEBUG} 오토 스위칭: ${next} 추가 후 재시도`)
          }
        }
        if (toTry.indexOf(modelName) < toTry.length - 1) continue
        return result
      }
    }
    if (result.ok) break
  }
  return result
}
