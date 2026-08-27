/**
 * 매일: 공급사·레인별 나라 1개 또는 도시별 1개 수집 → 검증 통과만 등록대기, 실패는 차단 후 파서 수정.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: ingest then heal — manifest
 * REGRESSION-FREEZE[register-pre-photo-pending-verify-gate]: 검증 통과만 pending — manifest
 */
import { ingestUnregisteredRegisterPendingPrePhoto } from '@/lib/register-pre-photo-listing-ingest'
import { healPendingRegisterPrePhoto } from '@/lib/register-pending-pre-photo-self-heal'

export async function runRegisterPrePhotoDailyJob(opts?: {
  dryRun?: boolean
  probeImageUrls?: boolean
  healLimit?: number
  skipIngest?: boolean
}) {
  const skipIngest =
    opts?.skipIngest === true || process.env.DISABLE_REGISTER_PRE_PHOTO_LISTING_INGEST === '1'
  const ingest = skipIngest
    ? {
        scannedGeos: 0,
        created: 0,
        skippedDuplicate: 0,
        skippedNoListing: ['disabled'],
        failed: 0,
        perGeo: 1,
        bySupplier: {},
        byLane: { package: 0, air_hotel_free: 0 },
      }
    : await ingestUnregisteredRegisterPendingPrePhoto({ dryRun: opts?.dryRun })
  const heal = await healPendingRegisterPrePhoto({
    limit: opts?.healLimit ?? 40,
    dryRun: opts?.dryRun,
    probeImageUrls: opts?.probeImageUrls,
  })
  return { ingest, heal }
}
