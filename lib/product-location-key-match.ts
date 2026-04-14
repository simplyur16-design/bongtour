/**
 * 상품 → 해외 목적지 트리 SSOT(`overseas-location-tree`) 키 추론.
 * - 등록 실패를 유발하지 않음(항상 try/catch, null 허용).
 * - 기존 `matchProductToOverseasNode` 재사용.
 */
import type { OverseasProductMatchInput } from '@/lib/match-overseas-product'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'

export type ProductLocationKeyMatchInput = {
  title: string
  originSource: string
  primaryDestination?: string | null
  destinationRaw?: string | null
  primaryRegion?: string | null
  destination?: string | null
  /** 일정 제목·본문 등 추가 힌트(길면 잘림) */
  bodyText?: string | null
}

/** Prisma `Product`에 그대로 spread 가능한 보조 필드만 */
export type ProductLocationKeyPrismaFields = {
  countryKey: string | null
  nodeKey: string | null
  groupKey: string | null
  locationMatchConfidence: string | null
  locationMatchSource: string | null
}

const BODY_MAX = 8000

function trimHaystackBody(body: string | null | undefined): string | null {
  const t = (body ?? '').trim()
  if (!t) return null
  return t.length > BODY_MAX ? t.slice(0, BODY_MAX) : t
}

/**
 * 트리 매칭으로 `countryKey` / `nodeKey` / `groupKey` 및 신뢰도 메타를 채운다.
 * 매칭 실패 시 전부 null.
 */
export function deriveProductLocationKeyFieldsForPrisma(
  input: ProductLocationKeyMatchInput
): ProductLocationKeyPrismaFields {
  const empty: ProductLocationKeyPrismaFields = {
    countryKey: null,
    nodeKey: null,
    groupKey: null,
    locationMatchConfidence: null,
    locationMatchSource: null,
  }

  try {
    const title = (input.title ?? '').trim()
    const originSource = (input.originSource ?? '').trim()
    if (!title && !originSource) return empty

    const body = trimHaystackBody(input.bodyText)
    const destRawMerged =
      [input.destinationRaw, body].filter((x) => x && String(x).trim()).join(' \n ') || input.destinationRaw || null

    const matchInput: OverseasProductMatchInput = {
      title: title || ' ',
      originSource: originSource || ' ',
      primaryDestination: input.primaryDestination,
      destinationRaw: destRawMerged,
      primaryRegion: input.primaryRegion,
      destination: input.destination,
    }

    const m = matchProductToOverseasNode(matchInput)
    if (!m) return empty

    const confidence = m.scope === 'leaf' ? 'high' : m.scope === 'country' ? 'medium' : 'low'
    const nodeKey = m.scope === 'leaf' && m.leafKey ? m.leafKey : null
    const countryKey = m.countryKey ?? null

    return {
      countryKey,
      nodeKey,
      groupKey: m.groupKey,
      locationMatchConfidence: confidence,
      locationMatchSource: `overseas-tree:${m.scope}`,
    }
  } catch {
    return empty
  }
}

/** `ParsedProductForDB` + 일정 설명 blob → 관리자 직접 등록 경로용 */
export function itineraryDescriptionsBlob(
  itineraries: { description: string }[] | null | undefined
): string | null {
  if (!itineraries?.length) return null
  const t = itineraries
    .map((i) => (i.description ?? '').trim())
    .filter(Boolean)
    .join('\n')
  return trimHaystackBody(t)
}
