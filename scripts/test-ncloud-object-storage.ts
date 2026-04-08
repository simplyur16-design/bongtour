/**
 * Ncloud Object Storage 단건 PutObject 진단. 민감값 원문 출력 금지.
 * `getNcloudS3Client()` = 업로드 유틸과 동일 S3 구성.
 */
import './load-env-for-scripts'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import {
  buildNcloudPublicUrl,
  getNcloudObjectStorageEnv,
  getNcloudS3Client,
  getNcloudS3ResolvedConfig,
} from '../lib/ncloud-object-storage'

const ENV_KEYS_CHECKED = [
  'NCLOUD_ACCESS_KEY',
  'NCLOUD_SECRET_KEY',
  'NCLOUD_OBJECT_STORAGE_ENDPOINT',
  'NCLOUD_OBJECT_STORAGE_REGION',
  'NCLOUD_OBJECT_STORAGE_BUCKET',
  'NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL',
  'NCLOUD_OBJECT_STORAGE_S3_ADDRESSING',
  'NCLOUD_OBJECT_STORAGE_REGION_CODE',
] as const

const OBJECT_KEY = 'test/healthcheck.txt'

function maskAccessKey(id: string): string {
  if (id.length === 0) return '(empty)'
  if (id.length <= 4) return '****'
  return id.slice(0, 4) + '*'.repeat(id.length - 4)
}

function printErr(e: unknown): void {
  const x = e as {
    name?: string
    message?: string
    Code?: string
    HostId?: string
    $metadata?: { httpStatusCode?: number; requestId?: string; extendedRequestId?: string }
  }
  console.error('[ncloud-test] error.name:', x.name ?? '(none)')
  console.error('[ncloud-test] error.message:', x.message ?? '(none)')
  console.error('[ncloud-test] statusCode:', x.$metadata?.httpStatusCode ?? '(none)')
  console.error('[ncloud-test] requestId:', x.$metadata?.requestId ?? '(none)')
  if (x.$metadata?.extendedRequestId) {
    console.error('[ncloud-test] extendedRequestId:', x.$metadata.extendedRequestId)
  }
  if (x.HostId) console.error('[ncloud-test] hostId:', x.HostId)
  if (x.Code) console.error('[ncloud-test] Code:', x.Code)
}

async function main(): Promise<void> {
  console.log('[ncloud-test] env keys checked:', ENV_KEYS_CHECKED.join(', '))

  let env: ReturnType<typeof getNcloudObjectStorageEnv>
  try {
    env = getNcloudObjectStorageEnv()
  } catch (err) {
    console.error('[ncloud-test] getNcloudObjectStorageEnv:', err instanceof Error ? err.message : err)
    process.exit(1)
    return
  }

  const resolved = getNcloudS3ResolvedConfig()
  console.log('[ncloud-test] NCLOUD_ACCESS_KEY:', maskAccessKey(env.accessKey))
  console.log('[ncloud-test] NCLOUD_SECRET_KEY:', `length=${env.secretKey.length}`)
  console.log('[ncloud-test] NCLOUD_OBJECT_STORAGE_ENDPOINT (env):', env.s3Addressing === 'path' ? env.endpoint : '(virtual 모드 — 아래 resolved 사용)')
  console.log('[ncloud-test] NCLOUD_OBJECT_STORAGE_REGION:', env.region)
  console.log('[ncloud-test] NCLOUD_OBJECT_STORAGE_BUCKET:', env.bucket)
  console.log('[ncloud-test] NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL:', env.publicBaseUrl.replace(/\/+$/, ''))
  console.log(
    '[ncloud-test] resolved S3:',
    resolved.s3Addressing,
    resolved.endpoint,
    'forcePathStyle=',
    resolved.forcePathStyle,
    'signingRegion=',
    resolved.signingRegion
  )

  const client = getNcloudS3Client()
  const body = Buffer.from(`ok ${new Date().toISOString()}\n`, 'utf8')

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: env.bucket,
        Key: OBJECT_KEY,
        Body: body,
        ContentType: 'text/plain; charset=utf-8',
      })
    )
    const publicUrl = buildNcloudPublicUrl(env.publicBaseUrl, OBJECT_KEY)
    console.log('[ncloud-test] PutObject OK')
    console.log('[ncloud-test] objectKey:', OBJECT_KEY)
    console.log('[ncloud-test] bucket:', env.bucket)
    console.log('[ncloud-test] endpoint:', resolved.endpoint)
    console.log('[ncloud-test] publicUrl:', publicUrl)
    process.exit(0)
  } catch (e) {
    console.error('[ncloud-test] PutObject FAIL')
    printErr(e)
    process.exit(1)
  }
}

void main()
