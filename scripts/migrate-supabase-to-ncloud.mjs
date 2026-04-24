/**
 * Supabase Storage `bongtour-images`(또는 SUPABASE_IMAGE_BUCKET) 버킷 **전체** 객체를
 * Naver Cloud Object Storage(S3)로 복사하고, DB 문자열에서 Supabase 공개 URL을 Ncloud URL로 치환한다.
 * 폴더(prefix) 구조는 object key 그대로 유지된다.
 *
 * 요구: .env.local — SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_IMAGE_BUCKET(선택),
 *       NCLOUD_ACCESS_KEY, NCLOUD_SECRET_KEY, NCLOUD_OBJECT_STORAGE_*
 *
 *   node scripts/migrate-supabase-to-ncloud.mjs           # dry-run: 인벤토리 출력, 업로드·DB 미적용
 *   node scripts/migrate-supabase-to-ncloud.mjs --apply   # 실제 업로드 + DB 갱신
 *
 * 동일 object key로 다시 실행하면 PutObject가 **덮어쓰기**된다(ACL public-read 유지).
 */

import { existsSync } from 'fs'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { PrismaClient } from '../prisma-gen-runtime/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function loadEnv() {
  process.chdir(ROOT)
  const envLocal = path.join(ROOT, '.env.local')
  const envDefault = path.join(ROOT, '.env')
  if (existsSync(envLocal)) config({ path: envLocal, override: true })
  if (existsSync(envDefault)) config({ path: envDefault })
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function contentTypeForKey(key) {
  const ext = path.extname(key).toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    case '.avif':
      return 'image/avif'
    default:
      return 'application/octet-stream'
  }
}

function rowIsFile(row) {
  return row.metadata != null && typeof row.metadata.size === 'number'
}

/**
 * 버킷 루트부터 재귀적으로 **모든** 파일 object key 수집 (prefix 필터 없음).
 * 폴더 행은 metadata.size 없음으로 간주하고 하위로 walk.
 */
async function listAllSupabaseStorageObjectKeys(supabase, bucket) {
  const out = []

  async function walk(rel) {
    let offset = 0
    const pageSize = 1000
    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list(rel || '', {
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) throw new Error(`Supabase list failed (${rel || '<root>'}): ${error.message}`)
      const rows = data ?? []
      if (rows.length === 0) break
      for (const row of rows) {
        const name = row.name
        if (!name) continue
        const full = rel ? `${rel}/${name}` : name
        if (rowIsFile(row)) {
          if (!full.endsWith('/.keep')) out.push(full)
        } else {
          await walk(full)
        }
      }
      if (rows.length < pageSize) break
      offset += pageSize
    }
  }

  await walk('')
  return [...new Set(out)].sort((a, b) => a.localeCompare(b, 'en'))
}

/** 상위 폴더(첫 경로 세그먼트)별 파일 개수 */
function summarizeByTopLevelPrefix(keys) {
  const map = new Map()
  for (const k of keys) {
    const i = k.indexOf('/')
    const prefix = i >= 0 ? k.slice(0, i) : '(root files)'
    map.set(prefix, (map.get(prefix) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en'))
}

/**
 * 버킷 인벤토리: 폴더(상위 prefix)별 요약 + object key 전체 목록.
 * dry-run: 전체 키를 모두 출력(대량이면 터미널/리다이렉트 활용).
 * --apply: 요약만 출력하고 키 전체는 생략(로그 과다 방지).
 */
function printInventory(keys, apply) {
  console.log('')
  console.log('[migrate] ========== Storage inventory ==========')
  console.log('[migrate] total file objects:', keys.length)
  const summary = summarizeByTopLevelPrefix(keys)
  console.log('[migrate] by top-level prefix / folder:')
  for (const [p, n] of summary) {
    console.log(`[migrate]   ${p}/**  →  ${n} file(s)`)
  }
  if (apply) {
    console.log('[migrate] (apply mode: full key list omitted; re-run without --apply to list all keys)')
  } else {
    console.log('[migrate] --- full object keys (sorted, dry-run) ---')
    for (const k of keys) {
      console.log('[migrate]   ', k)
    }
  }
  console.log('[migrate] ========== end inventory ==========')
  console.log('')
}

/** oldBase 이후 오브젝트 키를 잡아 Ncloud public base로 치환 (버킷 내 모든 경로) */
function buildStorageUrlMigrator(oldBase, newBase) {
  const re = new RegExp(escapeRe(oldBase) + '([^?\\s"\']+)', 'g')
  const base = newBase.replace(/\/+$/, '')
  return (s) => {
    if (typeof s !== 'string') return s
    if (!s.includes(oldBase)) return s
    return s.replace(re, (_, key) => `${base}/${key}`)
  }
}

function deepMigrateStrings(value, migrate) {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return migrate(value)
  if (Array.isArray(value)) return value.map((v) => deepMigrateStrings(v, migrate))
  if (typeof value === 'object') {
    const o = {}
    for (const [k, v] of Object.entries(value)) {
      o[k] = deepMigrateStrings(v, migrate)
    }
    return o
  }
  return value
}

function whereContainsSupabasePublicUrl(field, oldBase) {
  return { [field]: { contains: oldBase } }
}

async function patchScalar(prisma, delegate, label, field, migrator, apply) {
  const rows = await delegate.findMany({
    where: whereContainsSupabasePublicUrl(field, migrator.oldBase),
    select: { id: true, [field]: true },
  })
  let n = 0
  for (const r of rows) {
    const cur = r[field]
    if (typeof cur !== 'string') continue
    const next = migrator.fn(cur)
    if (next === cur) continue
    n += 1
    if (apply) {
      await delegate.update({ where: { id: r.id }, data: { [field]: next } })
      console.log(`[db] ${label}.${field} id=${r.id}`)
    } else {
      console.log(`[db] (dry) ${label}.${field} id=${r.id}`)
    }
  }
  return n
}

async function main() {
  loadEnv()
  const apply = process.argv.includes('--apply')

  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const supBucket = process.env.SUPABASE_IMAGE_BUCKET?.trim() || 'bongtour-images'
  const oldBase = `${supabaseUrl}/storage/v1/object/public/${supBucket}/`

  const ncloudPublic = process.env.NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '')
  const ncloudBucket = process.env.NCLOUD_OBJECT_STORAGE_BUCKET?.trim()
  const ncloudEndpoint = process.env.NCLOUD_OBJECT_STORAGE_ENDPOINT?.trim()
  const ncloudRegion = process.env.NCLOUD_OBJECT_STORAGE_REGION?.trim() || 'kr-standard'
  const accessKey = process.env.NCLOUD_ACCESS_KEY?.trim()
  const secretKey = process.env.NCLOUD_SECRET_KEY?.trim()
  const addressing = (process.env.NCLOUD_OBJECT_STORAGE_S3_ADDRESSING ?? 'path').toLowerCase().trim()
  const forcePathStyle = addressing !== 'virtual'

  if (!supabaseUrl || !supabaseKey) {
    console.error('[migrate] SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
    process.exit(1)
  }
  if (!ncloudPublic || !ncloudBucket || !ncloudEndpoint || !accessKey || !secretKey) {
    console.error('[migrate] NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL, BUCKET, ENDPOINT, ACCESS_KEY, SECRET_KEY 필요')
    process.exit(1)
  }
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[migrate] DATABASE_URL 필요')
    process.exit(1)
  }

  const newBase = `${ncloudPublic}/`
  const migrateFn = buildStorageUrlMigrator(oldBase, newBase)
  const migrator = { fn: migrateFn, oldBase }

  console.log('[migrate] mode:', apply ? 'APPLY' : 'dry-run')
  console.log('[migrate] Supabase bucket (entire):', supBucket)
  console.log('[migrate] old URL prefix:', oldBase)
  console.log('[migrate] new URL prefix:', newBase)

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const keys = await listAllSupabaseStorageObjectKeys(supabase, supBucket)

  printInventory(keys, apply)

  if (!apply) {
    console.log('[migrate] dry-run: Supabase→Ncloud 바이너리 복사는 생략(목록·DB 스캔만). 실제 반영:')
    console.log('[migrate]   node scripts/migrate-supabase-to-ncloud.mjs --apply')
  }

  console.log('[migrate] objects to copy (on --apply):', keys.length)

  let uploaded = 0
  if (apply) {
    const s3 = new S3Client({
      region: ncloudRegion,
      endpoint: ncloudEndpoint,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle,
    })

    for (const key of keys) {
      const { data: blob, error: dlErr } = await supabase.storage.from(supBucket).download(key)
      if (dlErr || !blob) {
        console.error('[migrate] download failed:', key, dlErr?.message)
        continue
      }
      const buf = Buffer.from(await blob.arrayBuffer())
      await s3.send(
        new PutObjectCommand({
          Bucket: ncloudBucket,
          Key: key,
          Body: buf,
          ContentType: contentTypeForKey(key),
          ACL: 'public-read',
        }),
      )
      uploaded += 1
      if (uploaded % 50 === 0 || uploaded === keys.length) {
        console.log('[migrate] objects copied:', uploaded, '/', keys.length)
      }
    }
  }

  let prisma
  try {
    prisma = new PrismaClient()
  } catch (e) {
    console.error('[migrate] Prisma Client 로드 실패. `npx prisma generate` 후 재시도.')
    console.error(e?.message || e)
    process.exit(1)
  }

  let dbPatches = 0
  try {
    dbPatches += await patchScalar(prisma, prisma.product, 'Product', 'bgImageUrl', migrator, apply)
    dbPatches += await patchScalar(prisma, prisma.destination, 'Destination', 'imageUrl', migrator, apply)
    dbPatches += await patchScalar(prisma, prisma.destinationImageSet, 'DestinationImageSet', 'mainImageUrl', migrator, apply)
    dbPatches += await patchScalar(prisma, prisma.destinationImageSet, 'DestinationImageSet', 'scheduleImageUrls', migrator, apply)
    dbPatches += await patchScalar(prisma, prisma.editorialContent, 'EditorialContent', 'heroImageUrl', migrator, apply)
    dbPatches += await patchScalar(prisma, prisma.monthlyCurationContent, 'MonthlyCurationContent', 'imageUrl', migrator, apply)
    dbPatches += await patchScalar(prisma, prisma.imageAsset, 'ImageAsset', 'publicUrl', migrator, apply)
    dbPatches += await patchScalar(prisma, prisma.pageOgImage, 'PageOgImage', 'imageUrl', migrator, apply)
    dbPatches += await patchScalar(prisma, prisma.assetUsageLog, 'AssetUsageLog', 'assetPath', migrator, apply)
    dbPatches += await patchScalar(prisma, prisma.photoPool, 'PhotoPool', 'filePath', migrator, apply)

    const products = await prisma.product.findMany({ select: { id: true, schedule: true } })
    for (const p of products) {
      if (p.schedule == null) continue
      let j
      try {
        j = JSON.parse(p.schedule)
      } catch {
        continue
      }
      const next = deepMigrateStrings(j, migrateFn)
      if (JSON.stringify(next) === JSON.stringify(j)) continue
      dbPatches += 1
      if (apply) {
        await prisma.product.update({ where: { id: p.id }, data: { schedule: JSON.stringify(next) } })
        console.log(`[db] Product.schedule id=${p.id}`)
      } else {
        console.log(`[db] (dry) Product.schedule id=${p.id}`)
      }
    }

    const hub = await prisma.homeHubActiveConfig.findUnique({ where: { id: 'singleton' } }).catch(() => null)
    if (hub?.data) {
      const next = deepMigrateStrings(hub.data, migrateFn)
      if (JSON.stringify(next) !== JSON.stringify(hub.data)) {
        dbPatches += 1
        if (apply) {
          await prisma.homeHubActiveConfig.update({ where: { id: 'singleton' }, data: { data: next } })
          console.log('[db] HomeHubActiveConfig.data')
        } else {
          console.log('[db] (dry) HomeHubActiveConfig.data')
        }
      }
    }
  } finally {
    await prisma.$disconnect()
  }

  console.log('[migrate] done. storage objects:', uploaded, 'db patch rows/sections:', dbPatches)
  if (!apply) {
    console.log('[migrate] dry-run only. 실제 반영: node scripts/migrate-supabase-to-ncloud.mjs --apply')
  }
}

main().catch((e) => {
  console.error('[migrate] failed:', e)
  process.exit(1)
})
