/**
 * 오로라 관측·헌팅 상품 — imageKeyword(1번 슬롯)에 오로라를 최소 1회 넣는다.
 * REGRESSION-FREEZE[register-aurora-primary-image-keyword]: 오로라 상품 primary aurora — manifest
 */
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'

export const AURORA_PRIMARY_IMAGE_KEYWORD = 'Northern Lights aurora sky'

const AURORA_PRODUCT_TITLE_RE = /오로라|aurora|northern\s*lights/i
const AURORA_KEYWORD_RE = /오로라|aurora|northern\s*lights|polar\s*lights/i
const AURORA_ROUTE_HINT_RE = /오로라|aurora|northern\s*lights|헌팅/i

export function isAuroraHuntingProductTitle(title: string | null | undefined): boolean {
  return AURORA_PRODUCT_TITLE_RE.test(String(title ?? ''))
}

export function imageKeywordMentionsAurora(raw: string | null | undefined): boolean {
  return AURORA_KEYWORD_RE.test(String(raw ?? ''))
}

type KwRow = {
  day: number
  title?: string | null
  routeText?: string | null
  description?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

/** 상품 단위 — primary(imageKeyword)에 오로라가 없으면 적합한 중간일에 1번으로 넣는다. */
export function ensureAuroraPrimaryImageKeyword<T extends KwRow>(
  rows: T[],
  productTitle?: string | null,
): T[] {
  if (!rows.length || !isAuroraHuntingProductTitle(productTitle)) return rows

  const scrubLaura = (row: T): T => {
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    if (!/Laura\s*Village/i.test(kw2)) return row
    return { ...row, imageKeyword2: null }
  }

  if (rows.some((r) => imageKeywordMentionsAurora(r.imageKeyword))) {
    return rows.map(scrubLaura)
  }

  const sorted = [...rows].sort((a, b) => Number(a.day) - Number(b.day))
  const active = sorted.filter((r) => Number(r.day) > 0)
  if (!active.length) return rows.map(scrubLaura)
  const maxDay = Math.max(...active.map((r) => Number(r.day)))
  const activeDays = active.length

  const middle = active.filter((r) => {
    const slot = resolveScheduleKeywordSlotKind(Number(r.day), maxDay, activeDays)
    return slot === 'middle'
  })
  const pool = middle.length ? middle : active

  const routeHit = pool.find((r) =>
    AURORA_ROUTE_HINT_RE.test(`${String(r.routeText ?? '')} ${String(r.title ?? '')}`),
  )
  const target = routeHit ?? pool[Math.min(1, pool.length - 1)] ?? pool[0]
  if (!target) return rows.map(scrubLaura)

  const auroraNk = normScheduleImageKeywordKey(AURORA_PRIMARY_IMAGE_KEYWORD)
  const out = sorted.map((row) => {
    const base = scrubLaura(row)
    if (Number(base.day) !== Number(target.day)) return base
    const prev = String(base.imageKeyword ?? '').trim()
    const prev2 = String(base.imageKeyword2 ?? '').trim()
    const prevNk = normScheduleImageKeywordKey(prev)
    let next2 = prev2
    if (
      prev &&
      prevNk &&
      prevNk !== auroraNk &&
      !imageKeywordMentionsAurora(prev) &&
      !next2 &&
      !/Laura\s*Village/i.test(prev)
    ) {
      next2 = prev
    }
    return {
      ...base,
      imageKeyword: AURORA_PRIMARY_IMAGE_KEYWORD,
      imageKeyword2: next2 || null,
    }
  })
  return out
}
