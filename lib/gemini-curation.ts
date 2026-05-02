/**
 * 월별 시즌 큐레이션(MonthlyCurationContent) — Gemini 생성.
 * 키: GEMINI_API_KEY, 모델: gemini-client 기본(GEMINI_MODEL, 기본 gemini-2.5-flash).
 */
import { prisma } from '@/lib/prisma'
import { extractFirstBalancedJsonArray, stripLlmMarkdownJsonFence } from '@/lib/llm-json-extract'
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'

const CURATION_MODEL = process.env.GEMINI_CURATION_MODEL?.trim() || getModelName()
const PAGE_SCOPE_OVERSEAS = 'overseas' as const

export type GenerateMonthlyCurationOptions = {
  /** true면 해당 월·해외 기존 행을 삭제한 뒤 재생성 */
  overwrite?: boolean
}

export type GenerateMonthlyCurationOk = {
  ok: true
  targetMonth: string
  created: number
  items: { id: string; title: string; linkedProductId: string | null; sortOrder: number }[]
}

export type GenerateMonthlyCurationErr = {
  ok: false
  error: string
  code?: 'INVALID_MONTH' | 'NO_PRODUCTS' | 'EXISTS' | 'GEMINI_KEY' | 'GEMINI_PARSE' | 'GEMINI_EMPTY'
}

export type GenerateMonthlyCurationResult = GenerateMonthlyCurationOk | GenerateMonthlyCurationErr

function isMonthKey(v: string): boolean {
  return /^\d{4}-\d{2}$/.test(v)
}

function monthUtcRange(monthKey: string): { start: Date; end: Date } {
  const [ys, ms] = monthKey.split('-')
  const y = parseInt(ys, 10)
  const m = parseInt(ms, 10)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error('Invalid monthKey')
  }
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0))
  return { start, end }
}

type ProductForCuration = {
  id: string
  title: string
  primaryDestination: string | null
  country: string | null
  continent: string | null
  city: string | null
  bgImageUrl: string | null
}

type CurationLlmRow = {
  productId: string
  title: string
  bodyKr: string
  ctaLabel: string
  countryCode: string
  subtitle?: string | null
}

function parseCurationLlmArray(text: string): CurationLlmRow[] {
  const raw = text.trim().replace(/^\uFEFF/, '')
  const fenced = stripLlmMarkdownJsonFence(raw)
  const arrStr =
    extractFirstBalancedJsonArray(fenced) ??
    extractFirstBalancedJsonArray(raw) ??
    extractFirstBalancedJsonArray(stripLlmMarkdownJsonFence(raw))
  if (!arrStr) {
    throw new Error('응답에서 JSON 배열을 찾지 못했습니다.')
  }
  const parsed = JSON.parse(arrStr) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('JSON 최상위가 배열이 아닙니다.')
  }
  const out: CurationLlmRow[] = []
  for (const el of parsed) {
    if (!el || typeof el !== 'object') continue
    const o = el as Record<string, unknown>
    const productId = typeof o.productId === 'string' ? o.productId.trim() : ''
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    const bodyKr = typeof o.bodyKr === 'string' ? o.bodyKr.trim() : ''
    const ctaLabel = typeof o.ctaLabel === 'string' ? o.ctaLabel.trim() : ''
    const countryCode = typeof o.countryCode === 'string' ? o.countryCode.trim() : ''
    const subtitle =
      typeof o.subtitle === 'string' && o.subtitle.trim() ? o.subtitle.trim() : null
    if (!productId || !title || !bodyKr || !ctaLabel) continue
    out.push({ productId, title, bodyKr, ctaLabel, countryCode: countryCode || '해외', subtitle })
  }
  return out
}

async function fetchOverseasProductsDepartingInMonth(monthKey: string): Promise<ProductForCuration[]> {
  const { start, end } = monthUtcRange(monthKey)
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      NOT: { travelScope: 'domestic' },
      departures: {
        some: {
          departureDate: { gte: start, lt: end },
        },
      },
    },
    select: {
      id: true,
      title: true,
      primaryDestination: true,
      country: true,
      continent: true,
      city: true,
      bgImageUrl: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 120,
  })
  return rows
}

function buildUserPrompt(targetMonth: string, products: ProductForCuration[]): string {
  const lines = products.map((p) => ({
    productId: p.id,
    title: p.title,
    primaryDestination: p.primaryDestination,
    country: p.country,
    continent: p.continent,
    city: p.city,
  }))
  return `당신은 한국 여행사의 시즌 마케팅 담당자입니다.

대상 월: ${targetMonth} (이 달에 출발 가능한 상품만 후보입니다.)

아래 JSON 배열은 해당 월에 출발일이 있는 등록 완료 해외 성격 상품 목록입니다.
목록에 있는 productId만 사용해야 하며, 목록에 없는 ID를 만들지 마세요.

후보 상품(JSON):
${JSON.stringify(lines, null, 0)}

요청:
1) 후보 중에서 이 시즌(${targetMonth})에 가장 매력적인 여행지·상품을 최대 5개까지 고르세요. (후보가 5개 미만이면 가능한 만큼만)
2) 각 항목에 대해 한국어로 작성합니다. 톤은 감성적이되 과장은 줄이고, 예시처럼 계절감·여운이 느껴지게:
   - 예시 제목: "5월의 이탈리아, 레몬 향기에 물드는 지중해의 오후"
   - 예시 본문: 지중해의 푸른 바다와 토스카나의 연두빛 구릉이 가장 아름답게 조화를 이루는 시기 같은 뉘앙스
3) bodyKr은 공백 포함 약 150자 전후(130~170자 권장)로, 왜 이 시즌에 그 여행지가 좋은지 설명하세요.
4) ctaLabel은 클릭을 유도하는 짧은 한 줄(예: "이탈리아 상품 보기", "발리 일정 살펴보기").

응답 형식: JSON 배열만 출력하세요. 설명 문장·마크다운 코드펜스 없이 배열만.
각 원소는 다음 키를 가집니다:
- productId (문자열, 위 후보의 id와 정확히 일치)
- title (문자열)
- subtitle (문자열, 선택 — 없으면 null 또는 생략)
- bodyKr (문자열)
- ctaLabel (문자열)
- countryCode (문자열, 한글 국가명이나 짧은 지역 라벨, 예: "이탈리아", "발리", "일본")`
}

/**
 * targetMonth(YYYY-MM) 기준 해외 등록 상품 중 해당 월 출발이 있는 후보로 Gemini 시즌 큐레이션을 생성해 DB에 저장합니다.
 */
export async function generateMonthlyCuration(
  targetMonth: string,
  options?: GenerateMonthlyCurationOptions
): Promise<GenerateMonthlyCurationResult> {
  const monthKey = targetMonth.trim()
  if (!isMonthKey(monthKey)) {
    return { ok: false, error: 'targetMonth는 YYYY-MM 형식이어야 합니다.', code: 'INVALID_MONTH' }
  }

  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) {
    return { ok: false, error: 'GEMINI_API_KEY(또는 GOOGLE_API_KEY)가 설정되어 있지 않습니다.', code: 'GEMINI_KEY' }
  }

  const existing = await prisma.monthlyCurationContent.count({
    where: { monthKey, pageScope: PAGE_SCOPE_OVERSEAS },
  })
  if (existing > 0 && !options?.overwrite) {
    return {
      ok: false,
      error: `이미 ${monthKey} 해외 시즌 큐레이션이 ${existing}건 있습니다. 덮어쓰려면 overwrite: true 로 요청하세요.`,
      code: 'EXISTS',
    }
  }

  const products = await fetchOverseasProductsDepartingInMonth(monthKey)
  if (products.length === 0) {
    return {
      ok: false,
      error: `${monthKey}에 출발일이 있는 등록 해외 상품이 없습니다.`,
      code: 'NO_PRODUCTS',
    }
  }

  const model = getGenAI().getGenerativeModel({ model: CURATION_MODEL })
  const prompt = buildUserPrompt(monthKey, products)
  let text: string
  try {
    const result = await model.generateContent(
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 4096,
          ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
        },
      },
      geminiTimeoutOpts(120_000)
    )
    text = result.response.text()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Gemini 호출 실패: ${msg}`, code: 'GEMINI_PARSE' }
  }

  let rows: CurationLlmRow[]
  try {
    rows = parseCurationLlmArray(text)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `응답 파싱 실패: ${msg}`, code: 'GEMINI_PARSE' }
  }

  const allowed = new Set(products.map((p) => p.id))
  const merged: CurationLlmRow[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    if (!allowed.has(r.productId) || seen.has(r.productId)) continue
    seen.add(r.productId)
    merged.push(r)
    if (merged.length >= 5) break
  }

  if (merged.length === 0) {
    return {
      ok: false,
      error: '모델이 유효한 productId를 반환하지 않았습니다. 다시 시도해 주세요.',
      code: 'GEMINI_EMPTY',
    }
  }

  const productById = new Map(products.map((p) => [p.id, p]))

  await prisma.$transaction(async (tx) => {
    if (options?.overwrite) {
      await tx.monthlyCurationContent.deleteMany({
        where: { monthKey, pageScope: PAGE_SCOPE_OVERSEAS },
      })
    }
    for (let i = 0; i < merged.length; i++) {
      const r = merged[i]!
      const p = productById.get(r.productId)
      const linkedHref = `/products/${r.productId}`
      const imageUrl = p?.bgImageUrl?.trim() || null
      const imageAlt = r.title.length > 120 ? `${r.title.slice(0, 117)}…` : r.title
      await tx.monthlyCurationContent.create({
        data: {
          monthKey,
          pageScope: PAGE_SCOPE_OVERSEAS,
          regionKey: p?.continent?.trim() || null,
          countryCode: r.countryCode?.trim() || p?.country?.trim() || null,
          title: r.title,
          subtitle: r.subtitle ?? null,
          bodyKr: r.bodyKr,
          ctaLabel: r.ctaLabel,
          linkedProductId: r.productId,
          linkedHref,
          imageUrl,
          imageAlt: imageAlt || null,
          isPublished: false,
          sortOrder: i,
        },
      })
    }
  })

  const createdRows = await prisma.monthlyCurationContent.findMany({
    where: { monthKey, pageScope: PAGE_SCOPE_OVERSEAS },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, title: true, linkedProductId: true, sortOrder: true },
  })

  return {
    ok: true,
    targetMonth: monthKey,
    created: createdRows.length,
    items: createdRows.map((x) => ({
      id: x.id,
      title: x.title,
      linkedProductId: x.linkedProductId,
      sortOrder: x.sortOrder,
    })),
  }
}
