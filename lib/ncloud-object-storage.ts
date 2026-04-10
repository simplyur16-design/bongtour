/**
 * @deprecated NCloud Object Storage는 사용하지 않습니다. `@/lib/object-storage`(Supabase Storage)로 통일했습니다.
 * 이 파일은 기존 import 경로·스크립트 호환을 위해 별칭만보냅니다.
 */

import { buildPublicUrlForObjectKey } from '@/lib/object-storage'

export type { ObjectStorageEnv as NcloudObjectStorageEnv, UploadStorageObjectResult as UploadNcloudObjectResult } from '@/lib/object-storage'

export {
  buildEditorialObjectKey,
  buildGeminiGeneratedObjectKey,
  buildHomeHubCandidateObjectKey,
  buildMonthlyCurationObjectKey,
  buildPhotoPoolObjectKey,
  getImageStorageBucket,
  getObjectStorageEnv as getNcloudObjectStorageEnv,
  isObjectStorageConfigured as isNcloudObjectStorageConfigured,
  removeStorageObject as removeNcloudObject,
  tryParseObjectKeyFromPublicUrl,
  uploadStorageObject as uploadNcloudObject,
} from '@/lib/object-storage'

/** @deprecated `buildPublicUrlForObjectKey(objectKey)` 사용. 첫 인자는 무시됩니다. */
export function buildNcloudPublicUrl(_publicBaseUrl: string, objectKey: string): string {
  return buildPublicUrlForObjectKey(objectKey)
}
