/**
 * public/uploads/gemini/ 아래(하위 폴더 포함) PNG → 동일 경로 .webp (sharp, max width 1200, quality 80)
 * DB·JSON 내 `/uploads/gemini/… .png` 경로를 `.webp`로 치환 후 원본 PNG 삭제.
 *
 * 실행: node scripts/convert-gemini-png-to-webp.mjs
 * 요구: DATABASE_URL(.env.local), sharp, `npx prisma generate` 성공(Prisma Client 생성됨)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { readdir, unlink, stat } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import sharp from 'sharp'
import { PrismaClient } from '../prisma-gen-runtime/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const GEMINI_DIR = path.join(ROOT, 'public', 'uploads', 'gemini')

const GEMINI_URL_RE = /(\/uploads\/gemini\/[^"'\\\s?]+\.)png\b/gi

function loadEnv() {
  process.chdir(ROOT)
  const envLocal = path.join(ROOT, '.env.local')
  const envDefault = path.join(ROOT, '.env')
  // .env.local 우선(동일 키는 덮어씀) → 이어서 .env로 누락 키만 보강(이미 있는 키는 유지)
  if (existsSync(envLocal)) config({ path: envLocal, override: true })
  if (existsSync(envDefault)) config({ path: envDefault })
}

function rewriteGeminiPngInString(s) {
  if (typeof s !== 'string') return s
  return s.replace(GEMINI_URL_RE, '$1webp')
}

function deepReplaceUrls(value) {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return rewriteGeminiPngInString(value)
  if (Array.isArray(value)) return value.map(deepReplaceUrls)
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = deepReplaceUrls(v)
    }
    return out
  }
  return value
}

/** Prisma v5: `{ not: null }` 필터 대신 문자열 조건만 사용(NULL은 매칭되지 않음). */
function whereGeminiPngField(field) {
  return {
    AND: [
      { [field]: { contains: '/uploads/gemini/' } },
      { [field]: { contains: '.png' } },
    ],
  }
}

async function listPngFilesRecursive(dir) {
  const out = []
  if (!existsSync(dir)) return out
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...(await listPngFilesRecursive(full)))
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.png')) {
      out.push(full)
    }
  }
  return out
}

async function convertPngFiles() {
  const pngs = await listPngFilesRecursive(GEMINI_DIR)
  console.log(`[convert] PNG files: ${pngs.length}`)
  const converted = []
  for (const pngPath of pngs) {
    const webpPath = pngPath.replace(/\.png$/i, '.webp')
    try {
      await sharp(pngPath)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(webpPath)
      const st = await stat(webpPath)
      console.log(
        `[convert] OK ${path.relative(ROOT, pngPath)} → ${path.relative(ROOT, webpPath)} (${st.size} bytes)`,
      )
      converted.push({ pngPath, webpPath })
    } catch (e) {
      console.error(`[convert] FAIL ${pngPath}:`, e?.message || e)
    }
  }
  return converted
}

async function patchJsonFileIfExists(relPath) {
  const abs = path.join(ROOT, relPath)
  if (!existsSync(abs)) return 0
  const raw = readFileSync(abs, 'utf8')
  const nextRaw = rewriteGeminiPngInString(raw)
  if (nextRaw === raw) return 0
  writeFileSync(abs, nextRaw, 'utf8')
  console.log(`[db] patched file ${relPath}`)
  return 1
}

/** 문자열 컬럼: Prisma findMany + 개별 update (SQLite/Postgres 공통, 부분 .png 치환 안전) */
async function patchScalarWhereContains(delegate, label, whereField) {
  const rows = await delegate.findMany({
    where: whereGeminiPngField(whereField),
    select: { id: true, [whereField]: true },
  })
  let n = 0
  for (const r of rows) {
    const cur = r[whereField]
    if (typeof cur !== 'string') continue
    const next = rewriteGeminiPngInString(cur)
    if (next === cur) continue
    await delegate.update({ where: { id: r.id }, data: { [whereField]: next } })
    console.log(`[db] ${label}.${whereField} id=${r.id}`)
    n += 1
  }
  return n
}

async function updateDatabase(prisma) {
  let n = 0

  n += await patchScalarWhereContains(prisma.product, 'Product', 'bgImageUrl')
  n += await patchScalarWhereContains(prisma.destination, 'Destination', 'imageUrl')
  n += await patchScalarWhereContains(prisma.destinationImageSet, 'DestinationImageSet', 'mainImageUrl')
  n += await patchScalarWhereContains(prisma.destinationImageSet, 'DestinationImageSet', 'scheduleImageUrls')
  n += await patchScalarWhereContains(prisma.editorialContent, 'EditorialContent', 'heroImageUrl')
  n += await patchScalarWhereContains(prisma.monthlyCurationContent, 'MonthlyCurationContent', 'imageUrl')
  n += await patchScalarWhereContains(prisma.imageAsset, 'ImageAsset', 'publicUrl')
  n += await patchScalarWhereContains(prisma.pageOgImage, 'PageOgImage', 'imageUrl')
  n += await patchScalarWhereContains(prisma.assetUsageLog, 'AssetUsageLog', 'assetPath')
  n += await patchScalarWhereContains(prisma.photoPool, 'PhotoPool', 'filePath')

  const products = await prisma.product.findMany({
    select: { id: true, schedule: true },
  })
  for (const p of products) {
    if (p.schedule == null) continue
    const next = deepReplaceUrls(p.schedule)
    if (JSON.stringify(next) === JSON.stringify(p.schedule)) continue
    await prisma.product.update({ where: { id: p.id }, data: { schedule: next } })
    console.log(`[db] Product.schedule id=${p.id}`)
    n += 1
  }

  const hub = await prisma.homeHubActiveConfig.findUnique({ where: { id: 'singleton' } }).catch(() => null)
  if (hub?.data) {
    const next = deepReplaceUrls(hub.data)
    if (JSON.stringify(next) !== JSON.stringify(hub.data)) {
      await prisma.homeHubActiveConfig.update({
        where: { id: 'singleton' },
        data: { data: next },
      })
      console.log('[db] HomeHubActiveConfig updated')
      n += 1
    }
  }

  n += await patchJsonFileIfExists('public/data/home-hub-active.json')
  n += await patchJsonFileIfExists('public/data/home-hub-candidates.json')

  return n
}

async function deletePngs(converted) {
  for (const { pngPath } of converted) {
    try {
      await unlink(pngPath)
      console.log(`[delete] ${path.relative(ROOT, pngPath)}`)
    } catch (e) {
      console.warn(`[delete] failed ${pngPath}:`, e?.message || e)
    }
  }
}

function createPrisma() {
  try {
    return new PrismaClient()
  } catch (e) {
    console.error(
      '[convert] Prisma Client를 불러올 수 없습니다. 프로젝트 루트에서 `npx prisma generate` 후 다시 실행하세요.',
    )
    console.error(e?.message || e)
    process.exit(1)
  }
}

async function main() {
  loadEnv()
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[convert] DATABASE_URL 없음. .env.local 확인.')
    process.exit(1)
  }

  const prisma = createPrisma()
  await prisma.$connect().catch((e) => {
    console.error('[convert] DB 연결 실패:', e?.message || e)
    process.exit(1)
  })

  mkdirSync(GEMINI_DIR, { recursive: true })

  const converted = await convertPngFiles()

  let dbPatches = 0
  try {
    dbPatches = await updateDatabase(prisma)
  } finally {
    await prisma.$disconnect()
  }
  console.log(`[db] total field/json patches: ${dbPatches}`)

  await deletePngs(converted)

  console.log('[convert] done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
