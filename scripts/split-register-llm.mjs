/**
 * Historical one-off: used to split the former `register-from-llm.ts` into `register-from-llm-*.ts`.
 * The monolithic source file has been removed; re-run only if you restore it from git history.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const srcPath = path.join(root, 'lib', 'register-from-llm.ts')
if (!fs.existsSync(srcPath)) {
  console.error('Missing', srcPath, '— script is archival only.')
  process.exit(1)
}
const raw = fs.readFileSync(srcPath, 'utf8')
const lines = raw.split(/\r?\n/)

const remove = new Set()
for (let i = 43; i <= 48; i++) remove.add(i) // DirectedFlightLineResolver export
for (let i = 77; i <= 108; i++) remove.add(i) // RegisterLlmParseError
for (let i = 140; i <= 393; i++) remove.add(i) // types through RegisterParseAudit

let base = lines.filter((_, idx) => !remove.has(idx)).join('\n')

const schemaImport = `import {
  RegisterLlmParseError,
  type CalendarItem,
  type DirectedFlightLineResolver,
  type RegisterExtractionFieldIssue,
  type RegisterGeminiLlmJson,
  type RegisterLlmParseOptionsCommon,
  type RegisterParseAudit,
  type RegisterParsed,
  type RegisterScheduleDay,
} from '@/lib/register-llm-schema-hanatour'`

base = base.replace(
  /import type \{ DetailBodyParseSnapshot \} from '@\/lib\/detail-body-parser'\n/,
  `import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'\n${schemaImport}\n`
)

const suppliers = [
  {
    file: 'register-from-llm-hanatour.ts',
    brand: 'hanatour',
    fn: 'parseForRegisterLlmHanatour',
    logTag: 'hanatour-llm',
    header:
      '/**\n * 하나투어 전용 Gemini JSON → RegisterParsed (LLM 본체). `register-parse-hanatour`만 호출.\n */',
    compact: true,
    verygoodOrigin: false,
    defaultResolverNote:
      '/** preset 없을 때 비표시 — 하나투어는 `resolveDirectedFlightLinesHanatour` 주입 전제 */',
    presetErr:
      "parseForRegisterLlmHanatour: presetDetailBody가 필요합니다. register-parse-hanatour 및 전용 /api/travel/parse-and-register-* 만 사용하세요.",
  },
  {
    file: 'register-from-llm-modetour.ts',
    brand: 'modetour',
    fn: 'parseForRegisterLlmModetour',
    logTag: 'modetour-llm',
    header:
      '/**\n * 모두투어 전용 Gemini JSON → RegisterParsed (LLM 본체). `register-parse-modetour`만 호출.\n */',
    compact: false,
    verygoodOrigin: false,
    defaultResolverNote:
      '/** preset 없을 때 비표시 — 모두투어는 `resolveDirectedFlightLinesModetour` 주입 전제 */',
    presetErr:
      "parseForRegisterLlmModetour: presetDetailBody가 필요합니다. register-parse-modetour 및 전용 /api/travel/parse-and-register-* 만 사용하세요.",
  },
  {
    file: 'register-from-llm-verygoodtour.ts',
    brand: 'verygoodtour',
    fn: 'parseForRegisterLlmVerygoodtour',
    logTag: 'verygood-llm',
    header:
      '/**\n * 참좋은여행 전용 Gemini JSON → RegisterParsed (LLM 본체). `register-parse-verygoodtour`만 호출.\n */',
    compact: false,
    verygoodOrigin: true,
    defaultResolverNote:
      '/** preset 없을 때 비표시 — 참좋은은 `resolveDirectedFlightLinesVerygoodtour` 주입 전제 */',
    presetErr:
      "parseForRegisterLlmVerygoodtour: presetDetailBody가 필요합니다. register-parse-verygoodtour 및 전용 /api/travel/parse-and-register-* 만 사용하세요.",
  },
  {
    file: 'register-from-llm-ybtour.ts',
    brand: 'ybtour',
    fn: 'parseForRegisterLlmYbtour',
    logTag: 'ybtour-llm',
    header:
      '/**\n * 노랑풍선(ybtour) 전용 Gemini JSON → RegisterParsed (LLM 본체). `register-parse-ybtour`만 호출.\n */',
    compact: false,
    verygoodOrigin: false,
    defaultResolverNote:
      '/** preset 없을 때 비표시 — 노랑풍선은 `resolveDirectedFlightLinesYbtour` 주입 전제 */',
    presetErr:
      "parseForRegisterLlmYbtour: presetDetailBody가 필요합니다. register-parse-ybtour 및 전용 /api/travel/parse-and-register-* 만 사용하세요.",
  },
]

function buildForSupplier(cfg) {
  let t = base

  t = t.replace(/^\/\*\*[\s\S]*?\*\/\nimport \{ getGenAI/m, `${cfg.header}\nimport { getGenAI`)

  if (cfg.verygoodOrigin) {
    t = t.replace(
      /import \{ extractVerygoodProCode, extractVerygoodSupplierGroupId, normalizeOriginSource \} from '\.\/supplier-origin'/,
      "import { extractVerygoodProCode, extractVerygoodSupplierGroupId, normalizeOriginSource } from './supplier-origin'"
    )
  } else {
    t = t.replace(
      /import \{ extractVerygoodProCode, extractVerygoodSupplierGroupId, normalizeOriginSource \} from '\.\/supplier-origin'/,
      "import { normalizeOriginSource } from './supplier-origin'"
    )
  }

  t = t.replace(
    /\/\*\* preset 없을 때 modetour 전제 generic resolver를 타지 않도록 기본값은 비표시 \*\//,
    cfg.defaultResolverNote
  )

  t = t.replace(
    /const MAX_SHOPPING_STOPS = 15\n\n/,
    `const MAX_SHOPPING_STOPS = 15\n\nconst REGISTER_BRAND = '${cfg.brand}' as const\n\n`
  )

  if (!cfg.compact) {
    const hStart = t.indexOf('/**\n * 하나투어 전용 풀 등록:')
    const pStart = t.indexOf('/**\n * 미리보기 전용: 전체 등록 JSON을 요구하지 않음')
    if (hStart >= 0 && pStart > hStart) {
      t = t.slice(0, hStart) + t.slice(pStart)
    }
  }

  t = t.replace(/export async function parseForRegister\(/, `export async function ${cfg.fn}(`)

  const optBlock = `  options?: {
    brandKey?: string | null
    originUrl?: string | null
    /** 상품유형 추론용: 실제 복붙 본문만 (없으면 제목 위주) */
    pastedBodyForInference?: string | null
    /** 관리자가 분리 입력한 붙여넣기 블록(선택) */
    pastedBlocks?: Partial<Omit<RegisterPastedBlocksInput, 'pastedBody'>> | null
    /** true: parse-and-register 미리보기 — LLM 출력 분량·지시 경량화(confirm·재파싱 경로와 동일 프롬프트 유지) */
    forPreview?: boolean
    /** 공급사 전용 파이프라인이 미리 만든 detail-body (있으면 공용에서 재파싱·항공 블록 병합 생략) */
    presetDetailBody?: DetailBodyParseSnapshot | null
    /** 가는/오는 편 문구 결정(공급사 전용 모듈에서 주입). 미지정 시 결정적 structured만 사용 */
    resolveDirectedFlightLines?: DirectedFlightLineResolver
    /**
     * true면 섹션별 Gemini repair 루프 생략(confirm 시 일정만 풀 파싱 보강 등).
     * repair + 풀 generateContent 연속 시 지연·SDK Abort(타임아웃) 완화.
     */
    skipDetailSectionGeminiRepairs?: boolean
    /** 섹션별 Gemini repair 최대 횟수(기본 3). 초과 시 이후 섹션은 스킵. */
    maxDetailSectionRepairs?: number
    /** 핸들러가 누적하는 LLM 호출 수(참조로 증가). */
    llmCallMetrics?: { mainLlm: number; repairLlm: number; sectionRepairLlm: number }
    /** parse-and-register 핸들러가 주입하는 구간 타이밍 훅(개발 로그용) */
    onTiming?: (label: string) => void
    /**
     * 풀 등록 시 LLM 출력 스키마 축소(항공·표 등은 전용 detail-body가 SSOT).
     * 브랜드 문자열 분기 없음 — 호출 측(\`register-parse-hanatour\` 등)에서만 설정.
     */
    llmRegisterSchema?: 'full' | 'compact'
  }
): Promise<RegisterParsed> {`
  if (!t.includes(optBlock)) {
    throw new Error(`${cfg.file}: options block not found for replacement`)
  }
  t = t.replace(optBlock, `  options?: RegisterLlmParseOptionsCommon\n): Promise<RegisterParsed> {`)

  t = t.replace(
    /'parseForRegister: presetDetailBody가 필요합니다\. register-parse-hanatour\|modetour\|verygoodtour\|ybtour 및 전용 \/api\/travel\/parse-and-register-\* 만 사용하세요\.'/,
    `'${cfg.presetErr.replace(/'/g, "\\'")}'`
  )

  if (cfg.compact) {
    t = t.replace(
      /  const useCompactRegisterSchema = options\?\.llmRegisterSchema === 'compact' && !forPreview\n  const registerPromptBody = useCompactRegisterSchema \? REGISTER_PROMPT_HANATOUR_COMPACT : REGISTER_PROMPT/,
      '  const useCompactRegisterSchema = !forPreview\n  const registerPromptBody = useCompactRegisterSchema ? REGISTER_PROMPT_HANATOUR_COMPACT : REGISTER_PROMPT'
    )
  } else {
    t = t.replace(
      /  const useCompactRegisterSchema = options\?\.llmRegisterSchema === 'compact' && !forPreview\n  const registerPromptBody = useCompactRegisterSchema \? REGISTER_PROMPT_HANATOUR_COMPACT : REGISTER_PROMPT/,
      '  const registerPromptBody = REGISTER_PROMPT'
    )
    t = t.replace(/\n  if \(useCompactRegisterSchema\) \{\n    console\.info\('\[parseForRegister\] compact-register schema',[\s\S]*?\n  \}\n/, '\n')
    t = t.replace(/\n  if \(useCompactRegisterSchema\) \{\n    const te = text\.trimEnd\(\)[\s\S]*?\n    \}\)\n  \}\n/, '\n')
    t = t.replace(
      /console\.error\('\[parseForRegister\] Gemini finishReason=MAX_TOKENS[\s\S]*?\}\)\n/,
      `console.error('[${cfg.logTag}] Gemini finishReason=MAX_TOKENS (출력 상한 도달·JSON 잘림 가능)', {\n      forPreview,\n      endsWithClosingBrace: text.trimEnd().endsWith('}'),\n      rawLength: text.length,\n    })\n`
    )
  }

  t = t.replace(/'\[parseForRegister\]/g, `'[${cfg.logTag}]`)
  t = t.replace(/logLabel: 'parseForRegister/g, `logLabel: '${cfg.fn}`)
  t = t.replace(/brandKey: options\?\.brandKey\?\.trim\(\) \|\| null/g, 'brandKey: REGISTER_BRAND')
  t = t.replace(
    /normalizeOriginSource\(raw\.originSource \?\? originSource, options\?\.brandKey\)/,
    'normalizeOriginSource(raw.originSource ?? originSource, REGISTER_BRAND)'
  )

  if (!cfg.verygoodOrigin) {
    t = t.replace(
      /  const fromUrlCode = extractVerygoodProCode\(originUrl\)\n  if \(fromUrlCode\) out\.originCode = fromUrlCode\n\n/,
      ''
    )
    t = t.replace(
      /  const normalizedSource = normalizeOriginSource\(raw\.originSource \?\? originSource, REGISTER_BRAND\)\n  const fromUrlProCode = extractVerygoodProCode\(options\?\.originUrl\)\n  const finalOriginCode = \(raw\.originCode \?\? ''\)\.trim\(\) \|\| fromUrlProCode \|\| '미지정'\n  const pastedForSupplier = options\?\.pastedBodyForInference\?\.trim\(\) \?\? ''\n  const supplierGroupFromText = extractVerygoodSupplierGroupId\(\n    pastedForSupplier\.length > 0 \? pastedForSupplier : rawText\n  \)/,
      `  const normalizedSource = normalizeOriginSource(raw.originSource ?? originSource, REGISTER_BRAND)\n  const finalOriginCode = (raw.originCode ?? '').trim() || '미지정'\n  const pastedForSupplier = options?.pastedBodyForInference?.trim() ?? ''\n  const supplierGroupFromText: string | null = null`
    )
  } else {
    t = t.replace(
      /  const normalizedSource = normalizeOriginSource\(raw\.originSource \?\? originSource, REGISTER_BRAND\)\n  const finalOriginCode = \(raw\.originCode \?\? ''\)\.trim\(\) \|\| '미지정'/,
      `  const normalizedSource = normalizeOriginSource(raw.originSource ?? originSource, REGISTER_BRAND)\n  const fromUrlProCode = extractVerygoodProCode(options?.originUrl)\n  const finalOriginCode = (raw.originCode ?? '').trim() || fromUrlProCode || '미지정'`
    )
    // restore supplier group for verygood — if previous replace didn't run, check current file state
  }

  if (cfg.compact) {
    t = t.replace(
      /llmRegisterSchema: options\?\.llmRegisterSchema \?\? null,\n      compactSchema: useCompactRegisterSchema,/,
      'compactSchema: useCompactRegisterSchema,'
    )
  }

  return t
}

for (const cfg of suppliers) {
  const out = path.join(root, 'lib', cfg.file)
  fs.writeFileSync(out, buildForSupplier(cfg), 'utf8')
  console.log('wrote', cfg.file)
}
