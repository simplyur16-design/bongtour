import { PRIVATE_TRIP_HERO_STORAGE_PREFIX } from '@/lib/private-trip-hero-constants'
import { getImageStorageBucket, isObjectStorageConfigured } from '@/lib/object-storage'
import { listPrivateTripHeroStoragePublicUrls } from '@/lib/private-trip-hero-supabase'

/** 관리자·공개 우리여행 히어로: Storage 목록만 (디스크는 더 이상 나열하지 않음) */
export type PrivateTripHeroFolderListingSource = 'supabase' | 'none'

export async function getPrivateTripHeroFolderListing(): Promise<{
  locationNote: string
  publicUrls: string[]
  source: PrivateTripHeroFolderListingSource
}> {
  const bucket = getImageStorageBucket()
  const prefix = `${PRIVATE_TRIP_HERO_STORAGE_PREFIX}/`
  const locationLine = `Supabase Storage · ${bucket}/${prefix}`

  if (!isObjectStorageConfigured()) {
    return {
      locationNote: `${locationLine} — 서버에 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY(·버킷)가 필요합니다.`,
      publicUrls: [],
      source: 'none',
    }
  }

  try {
    const storageUrls = await listPrivateTripHeroStoragePublicUrls()
    return {
      locationNote: locationLine,
      publicUrls: storageUrls,
      source: 'supabase',
    }
  } catch (e) {
    console.warn('[private-trip-hero] 관리자 목록: Storage 목록 실패', e)
    return {
      locationNote: `${locationLine} (목록 조회 실패 — 업로드는 가능할 수 있음)`,
      publicUrls: [],
      source: 'supabase',
    }
  }
}
