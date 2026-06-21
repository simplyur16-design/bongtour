/**
 * 공급사별 동일 상품 중복 등록 방지 — originCode 외 URL·공급사 dedupe 키 조회 SSOT.
 * REGRESSION-FREEZE[register-product-duplicate-guard]
 */
import type { Prisma, PrismaClient } from '@prisma/client'

import { parseHanatourPkgCdFromUrl } from '@/lib/hanatour-api-departures'
import { extractLottetourMasterIdsFromBlob } from '@/lib/lottetour-paste-deterministic-patch'
import { parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { parseVerygoodProCodeFromUrl } from '@/lib/register-facts'
import { parseYbtourEvCdFromUrl } from '@/lib/ybtour-api-departures'

/** parse-and-register confirm fingerprint 와 동일 — trailing slash·길이 상한 */
export function normalizeRegisterOriginUrl(u: string | null | undefined): string {
  try {
    let s = (typeof u === 'string' ? u : String(u ?? '')).trim().replace(/\/+$/, '')
    if (!s) return ''
    if (s.length > 2000) s = s.slice(0, 2000)
    return s
  } catch {
    return ''
  }
}

export type RegisterProductDedupeKey =
  | { kind: 'originUrl'; value: string }
  | { kind: 'supplierCode'; value: string }

/** 공급사 canonical key + URL/코드에서 dedupe 키 추출 */
export function extractRegisterProductDedupeKeys(
  originSource: string,
  originUrl: string | null | undefined,
): RegisterProductDedupeKey[] {
  const keys: RegisterProductDedupeKey[] = []
  const normUrl = normalizeRegisterOriginUrl(originUrl)
  if (normUrl) keys.push({ kind: 'originUrl', value: normUrl })

  const supplier = normalizeSupplierOrigin(originSource)
  const url = normUrl || (typeof originUrl === 'string' ? originUrl : '')

  if (supplier === 'modetour') {
    const productNo = parseModetourPackageProductNoFromUrl(url)
    if (productNo && productNo !== '0') keys.push({ kind: 'supplierCode', value: `modetour:productNo:${productNo}` })
  } else if (supplier === 'hanatour') {
    const pkgCd = parseHanatourPkgCdFromUrl(url)
    if (pkgCd) keys.push({ kind: 'supplierCode', value: `hanatour:pkgCd:${pkgCd}` })
  } else if (supplier === 'ybtour') {
    const evCd = parseYbtourEvCdFromUrl(url)
    if (evCd) keys.push({ kind: 'supplierCode', value: `ybtour:evCd:${evCd}` })
  } else if (supplier === 'verygoodtour') {
    const proCode = parseVerygoodProCodeFromUrl(url)
    if (proCode) keys.push({ kind: 'supplierCode', value: `verygoodtour:proCode:${proCode}` })
  } else if (supplier === 'lottetour') {
    const ids = extractLottetourMasterIdsFromBlob(url)
    if (ids.evtCd) keys.push({ kind: 'supplierCode', value: `lottetour:evtCd:${ids.evtCd}` })
    if (ids.godId) keys.push({ kind: 'supplierCode', value: `lottetour:godId:${ids.godId}` })
  }

  const seen = new Set<string>()
  return keys.filter((k) => {
    const id = `${k.kind}:${k.value}`
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

const ORIGIN_SOURCES_FOR_CANONICAL: Record<string, string[]> = {
  hanatour: ['hanatour'],
  modetour: ['modetour'],
  verygoodtour: ['verygoodtour'],
  ybtour: ['ybtour', 'yellowballoon'],
  kyowontour: ['kyowontour'],
  lottetour: ['lottetour'],
}

export function originSourcesForCanonicalSupplier(originSource: string): string[] {
  const key = normalizeSupplierOrigin(originSource)
  return ORIGIN_SOURCES_FOR_CANONICAL[key] ?? [originSource.trim()].filter(Boolean)
}

/**
 * 등록 화면 originUrl 중복 경고 대상 여부.
 * 반려(rejected)는 재등록 시 동일 행을 갱신하므로 “이미 등록됨” 경고에서 제외한다.
 */
export function shouldWarnRegisterOriginUrlDuplicate(registrationStatus: string | null | undefined): boolean {
  return (registrationStatus ?? 'pending') !== 'rejected'
}

export type RegisterExistingProductRow = {
  id: string
  originSource: string
  originCode: string
  originUrl: string | null
  registrationStatus: string | null
  title: string
  updatedAt: Date
}

type FindExistingArgs = {
  originSource: string
  originCode: string
  originUrl: string | null | undefined
  include?: Prisma.ProductInclude
}

/** originSource+originCode 우선, URL·공급사 dedupe 키로 기존 행 조회 */
export async function findExistingProductForRegister<TInclude extends Prisma.ProductInclude | undefined>(
  prisma: PrismaClient,
  args: FindExistingArgs & { include?: TInclude },
): Promise<
  TInclude extends Prisma.ProductInclude
    ? Prisma.ProductGetPayload<{ include: TInclude }> | null
    : RegisterExistingProductRow | null
> {
  const exact = await prisma.product.findUnique({
    where: {
      originSource_originCode: {
        originSource: args.originSource,
        originCode: args.originCode,
      },
    },
    ...(args.include ? { include: args.include } : {}),
  })
  if (exact) return exact as never

  const sources = originSourcesForCanonicalSupplier(args.originSource)
  const dedupeKeys = extractRegisterProductDedupeKeys(args.originSource, args.originUrl)
  if (dedupeKeys.length === 0) return null as never

  const candidates = await prisma.product.findMany({
    where: { originSource: { in: sources } },
    ...(args.include ? { include: args.include } : {}),
    select: args.include
      ? undefined
      : {
          id: true,
          originSource: true,
          originCode: true,
          originUrl: true,
          registrationStatus: true,
          title: true,
          updatedAt: true,
        },
  })

  for (const row of candidates) {
    const rowKeys = extractRegisterProductDedupeKeys(row.originSource, row.originUrl)
    for (const key of dedupeKeys) {
      if (rowKeys.some((rk) => rk.kind === key.kind && rk.value === key.value)) {
        return row as never
      }
    }
  }

  return null as never
}

export type DuplicateProductGroup = {
  canonicalSupplier: string
  dedupeKey: string
  products: RegisterExistingProductRow[]
}

/** DB 전체에서 공급사 dedupe 키 기준 중복 그룹 탐지 */
export function groupProductsByRegisterDedupeKey(
  rows: RegisterExistingProductRow[],
): DuplicateProductGroup[] {
  const map = new Map<string, RegisterExistingProductRow[]>()

  for (const row of rows) {
    const canonical = normalizeSupplierOrigin(row.originSource)
    if (canonical === 'etc') continue
    const keys = extractRegisterProductDedupeKeys(row.originSource, row.originUrl)
    for (const key of keys) {
      const groupId = `${canonical}|${key.kind}|${key.value}`
      const list = map.get(groupId) ?? []
      list.push(row)
      map.set(groupId, list)
    }
  }

  const out: DuplicateProductGroup[] = []
  for (const [groupId, products] of map) {
    const uniqueById = [...new Map(products.map((p) => [p.id, p])).values()]
    if (uniqueById.length < 2) continue
    const [canonicalSupplier, kind, ...rest] = groupId.split('|')
    out.push({
      canonicalSupplier,
      dedupeKey: `${kind}|${rest.join('|')}`,
      products: uniqueById.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    })
  }

  return out.sort((a, b) => b.products.length - a.products.length)
}

const STATUS_RANK: Record<string, number> = {
  registered: 4,
  pending: 3,
  on_hold: 2,
  rejected: 1,
  auto_unpublished: 0,
}

/** 중복 그룹에서 유지할 상품 id — registered 우선·최근 갱신 */
export function pickDuplicateProductKeeper(products: RegisterExistingProductRow[]): RegisterExistingProductRow {
  return [...products].sort((a, b) => {
    const rankA = STATUS_RANK[a.registrationStatus ?? ''] ?? 0
    const rankB = STATUS_RANK[b.registrationStatus ?? ''] ?? 0
    if (rankB !== rankA) return rankB - rankA
    return b.updatedAt.getTime() - a.updatedAt.getTime()
  })[0]!
}
