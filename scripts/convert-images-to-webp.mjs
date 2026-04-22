/**
 * public/images 이하의 .png / .jpg / .jpeg 를 재귀 순회해 같은 폴더에 .webp 생성 (원본 유지).
 * sharp: quality 80, effort 6, PNG 알파 유지.
 * 형제 .webp가 이미 있으면 스킵.
 *
 * 사용: node scripts/convert-images-to-webp.mjs
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const IMAGES_ROOT = path.join(ROOT, 'public', 'images')

const EXT_RE = /\.(png|jpe?g)$/i

function kb(n) {
  return (n / 1024).toFixed(1)
}

async function* walkFiles(dir) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      yield* walkFiles(full)
    } else if (e.isFile() && EXT_RE.test(e.name)) {
      yield full
    }
  }
}

async function main() {
  const files = []
  for await (const f of walkFiles(IMAGES_ROOT)) {
    files.push(f)
  }
  files.sort()

  let converted = 0
  let skipped = 0
  let failed = 0
  let totalOrig = 0
  let totalWebp = 0

  console.log(`Scan: ${IMAGES_ROOT} (${files.length} source images)\n`)

  for (const srcPath of files) {
    const dir = path.dirname(srcPath)
    const base = path.basename(srcPath).replace(EXT_RE, '')
    const outPath = path.join(dir, `${base}.webp`)

    try {
      const st = await fs.stat(srcPath)
      if (st.size === 0) {
        console.warn(`[skip empty] ${path.relative(ROOT, srcPath)}`)
        skipped++
        continue
      }

      try {
        await fs.access(outPath)
        skipped++
        continue
      } catch {
        /* no webp yet */
      }

      const origBuf = await fs.readFile(srcPath)
      const meta = await sharp(origBuf).metadata()
      const pipeline = sharp(origBuf).webp({
        quality: 80,
        effort: 6,
        alphaQuality: 100,
      })

      await pipeline.toFile(outPath)
      const outSt = await fs.stat(outPath)
      const rel = path.relative(ROOT, srcPath).replace(/\\/g, '/')
      const relOut = path.relative(ROOT, outPath).replace(/\\/g, '/')
      const o = origBuf.length
      const w = outSt.size
      totalOrig += o
      totalWebp += w
      converted++
      const pct = o ? (((o - w) / o) * 100).toFixed(1) : '0.0'
      console.log(
        `[ok] ${rel} (${kb(o)} KB) → ${relOut} (${kb(w)} KB)  −${pct}%  [${meta.format ?? '?'}${meta.hasAlpha ? ' +alpha' : ''}]`,
      )
    } catch (err) {
      failed++
      console.error(`[fail] ${path.relative(ROOT, srcPath)}`, err?.message ?? err)
    }
  }

  const saved = totalOrig - totalWebp
  const rate = totalOrig ? ((saved / totalOrig) * 100).toFixed(1) : '0.0'

  console.log('\n--- summary ---')
  console.log(`converted: ${converted}`)
  console.log(`skipped (webp exists or empty): ${skipped}`)
  console.log(`failed: ${failed}`)
  console.log(`original total: ${kb(totalOrig)} KB (${totalOrig} bytes)`)
  console.log(`webp total:     ${kb(totalWebp)} KB (${totalWebp} bytes)`)
  console.log(`saved:          ${kb(saved)} KB (${rate}% smaller)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
