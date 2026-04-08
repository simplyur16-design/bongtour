/**
 * Ncloud Object Storage smoke test (업로드 → 공개 URL 확인 → 삭제).
 * 실행: `npx tsx scripts/test-ncloud-upload.ts` (프로젝트 루트, NCLOUD_* 가 .env / .env.local 에 있어야 함)
 */
import {
  isNcloudObjectStorageConfigured,
  removeNcloudObject,
  uploadNcloudObject,
} from '../lib/ncloud-object-storage'

async function main(): Promise<void> {
  if (!isNcloudObjectStorageConfigured()) {
    console.error('[test-ncloud] NCLOUD_* 환경 변수가 없습니다.')
    process.exit(1)
  }
  const key = `__smoke__/test-${Date.now()}.txt`
  const body = Buffer.from('bongtour-ncloud-smoke', 'utf8')
  const r = await uploadNcloudObject({
    objectKey: key,
    body,
    contentType: 'text/plain; charset=utf-8',
  })
  console.log('[test-ncloud] uploaded:', r.publicUrl)
  await removeNcloudObject(key)
  console.log('[test-ncloud] removed:', key)
  console.log('[test-ncloud] ok')
}

main().catch((e) => {
  console.error('[test-ncloud] failed:', e)
  process.exit(1)
})
