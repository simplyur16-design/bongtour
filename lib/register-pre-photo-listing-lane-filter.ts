/**
 * 목록에서 뽑은 상세 URL이 패키지/자유여행 레인과 맞는지.
 * 하나투어·모두투어는 URL만으로 못 가르는 건 API로 확인한 뒤 확정에 넣는다.
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: 목록 레인 필터 — manifest
 */
import {
  fetchHanatourPkgProdInfo,
  parseHanatourPkgCdFromUrl,
} from '@/lib/hanatour-api-departures'
import { fetchModetourGroupDetailInfo } from '@/lib/modetour-departures'
import {
  inferHanatourListingProductKindFromOriginUrl,
  inferHanatourRegisterFactProductKind,
  inferModetourRegisterFactProductKind,
} from '@/lib/register-facts/product-kind'
import type { SupplierRegisterFactSource } from '@/lib/register-facts/types'
import {
  factKindMatchesIngestLane,
  listingUrlMatchesIngestLane,
  type RegisterPrePhotoIngestLane,
} from '@/lib/register-pre-photo-ingest-geo-slots'

export async function discoveredListingFitsIngestLane(
  supplier: SupplierRegisterFactSource,
  originUrl: string,
  lane: RegisterPrePhotoIngestLane,
): Promise<boolean> {
  if (!listingUrlMatchesIngestLane(supplier, originUrl, lane)) return false
  if (supplier === 'hanatour') {
    if (inferHanatourListingProductKindFromOriginUrl(originUrl) != null) return true
    const pkgCd = parseHanatourPkgCdFromUrl(originUrl)
    if (!pkgCd) return false
    const info = await fetchHanatourPkgProdInfo(pkgCd)
    if (!info) return false
    return factKindMatchesIngestLane(inferHanatourRegisterFactProductKind(info, originUrl), lane)
  }
  if (supplier === 'modetour') {
    const detail = await fetchModetourGroupDetailInfo(originUrl)
    if (!detail) return false
    return factKindMatchesIngestLane(inferModetourRegisterFactProductKind(detail), lane)
  }
  return true
}
