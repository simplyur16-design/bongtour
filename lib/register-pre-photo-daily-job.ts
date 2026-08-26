/**
 * 매일: 공급사·레인별 나라 1개 또는 도시별 1개 수집 → 등록대기 셀프힐·검증. 사진 생성 없음.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: ingest then heal — manifest
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
