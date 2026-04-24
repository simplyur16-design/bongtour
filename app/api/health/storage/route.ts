import { NextResponse } from 'next/server'
import { getImageStorageBucket, isObjectStorageConfigured } from '@/lib/object-storage'

/**
 * Object Storage(Ncloud S3, 이미지 업로드) 설정 여부 — 비밀값 없이 진단용.
 * 서버: `curl -sS "https://도메인/api/health/storage" | jq`
 * 로컬은 되는데 서버만 실패할 때: `?probe=1` 로 이 호스트에서 sharp(WebP 변환) 로드 여부 확인.
 */
export const dynamic = 'force-dynamic'

/** 1×1 PNG (투명) — sharp 파이프라인 스모크용 */
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

async function probeSharpPipeline(): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t0 = Date.now()
  try {
    const sharp = (await import('sharp')).default
    const out = await sharp(Buffer.from(TINY_PNG_B64, 'base64')).webp({ quality: 80 }).toBuffer()
    if (!out?.length) return { ok: false, ms: Date.now() - t0, error: 'sharp returned empty buffer' }
    return { ok: true, ms: Date.now() - t0 }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, ms: Date.now() - t0, error: msg }
  }
}

export async function GET(request: Request) {
  const ok = isObjectStorageConfigured()
  const { searchParams } = new URL(request.url)
  const probe = searchParams.get('probe') === '1'

  const hints: string[] = []
  if (!ok) {
    hints.push('NCLOUD_ACCESS_KEY, NCLOUD_SECRET_KEY, NCLOUD_OBJECT_STORAGE_* 를 서버 .env(PM2 ecosystem 포함)에 넣고 프로세스를 재시작하세요.')
  } else {
    hints.push(
      '로컬 OK·서버만 실패: Nginx 등 앞단에서 client_max_body_size(예: 32m)·413 여부, PM2에 위 env가 실제로 주입됐는지 확인하세요.',
    )
    if (!probe) {
      hints.push('이 서버에서 sharp 로드·WebP 변환 점검: 같은 URL에 ?probe=1 붙여 호출하세요.')
    }
  }

  let sharpProbe: { ok: boolean; ms: number; error?: string } | undefined
  if (probe) {
    sharpProbe = await probeSharpPipeline()
    if (!sharpProbe.ok) {
      hints.push(
        'sharp 실패 시: 배포 OS와 맞는 node_modules 재설치(npm ci), Alpine이면 libvips/sharp 문서 확인, ENOENT/undefined symbol 로그를 확인하세요.',
      )
    }
  }

  return NextResponse.json(
    {
      ok: true,
      objectStorage: ok ? 'configured' : 'missing_env',
      bucket: ok ? getImageStorageBucket() : null,
      hint: !ok ? hints[0] ?? null : null,
      hints: hints.length ? hints : undefined,
      runtime: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      sharpProbe,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
