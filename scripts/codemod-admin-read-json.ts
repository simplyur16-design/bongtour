/**
 * Codemod: replace unguarded `await res.json()` in admin client files
 * with `readAdminResponseJson(res)`.
 *
 * Usage: npx tsx scripts/codemod-admin-read-json.ts [--dry]
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DRY = process.argv.includes('--dry')

const IMPORT_LINE =
  "import { readAdminResponseJson } from '@/lib/admin/read-admin-response-json'"

const ROOTS = ['app/admin', 'components/admin']

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue
      walk(p, out)
    } else if (/\.(tsx|ts)$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
      out.push(p)
    }
  }
  return out
}

/** Match balanced `{...}` starting at index of `{` */
function takeBalancedObject(src: string, openIdx: number): string | null {
  if (src[openIdx] !== '{') return null
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return src.slice(openIdx, i + 1)
    }
  }
  return null
}

function transform(src: string): { next: string; changes: number } {
  let changes = 0
  let next = ''
  let i = 0

  while (i < src.length) {
    // Skip already-safe .json().catch
    const catchHit = src.slice(i).match(/^([A-Za-z_$][\w$]*)\s*\.\s*json\s*\(\s*\)\s*\.\s*catch\b/)
    if (catchHit) {
      next += catchHit[0]
      i += catchHit[0].length
      continue
    }

    // Pattern A: (await ident.json()) as Type
    const parenAs = src.slice(i).match(/^\(await\s+([A-Za-z_$][\w$]*)\s*\.\s*json\s*\(\s*\)\)\s*as\s+/)
    if (parenAs) {
      const ident = parenAs[1]
      const afterAs = i + parenAs[0].length
      let typeExpr: string
      let end = afterAs
      if (src[afterAs] === '{') {
        const obj = takeBalancedObject(src, afterAs)
        if (!obj) {
          next += src[i]
          i++
          continue
        }
        typeExpr = obj
        end = afterAs + obj.length
      } else {
        // single-line / simple type until ; or newline or `)` that closes outer call carefully
        const m = src.slice(afterAs).match(/^([A-Za-z0-9_$.|<&>\[\]'"\s]+?)(?=\s*[;,)\]}]|\r?\n)/)
        if (!m) {
          next += src[i]
          i++
          continue
        }
        typeExpr = m[1].trim()
        end = afterAs + m[1].length
      }
      next += `await readAdminResponseJson<${typeExpr}>(${ident})`
      changes++
      i = end
      continue
    }

    // Pattern B: await ident.json()  (not already readAdminResponseJson)
    const bare = src.slice(i).match(/^await\s+([A-Za-z_$][\w$]*)\s*\.\s*json\s*\(\s*\)/)
    if (bare) {
      // Don't rewrite if this is inside readAdminResponseJson already (rare)
      const lookback = next.slice(-40)
      if (!/readAdminResponseJson<\s*$/.test(lookback) && !/readAdminResponseJson\s*$/.test(lookback)) {
        next += `await readAdminResponseJson(${bare[1]})`
        changes++
        i += bare[0].length
        continue
      }
    }

    next += src[i]
    i++
  }

  if (changes > 0 && !next.includes("from '@/lib/admin/read-admin-response-json'")) {
    if (next.startsWith("'use client'") || next.startsWith('"use client"')) {
      next = next.replace(/^(['"]use client['"];?\r?\n)/, `$1\n${IMPORT_LINE}\n`)
    } else {
      next = `${IMPORT_LINE}\n${next}`
    }
  }

  return { next, changes }
}

function main() {
  const files = ROOTS.flatMap((r) => walk(path.join(ROOT, r)))
  let filesChanged = 0
  let totalChanges = 0

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8')
    if (!/await\s+[A-Za-z_$][\w$]*\s*\.\s*json\s*\(\s*\)/.test(src)) continue
    const { next, changes } = transform(src)
    if (changes === 0 || next === src) continue
    filesChanged++
    totalChanges += changes
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    console.log(`${rel}: ${changes}`)
    if (!DRY) fs.writeFileSync(file, next, 'utf8')
  }

  console.log(DRY ? `[dry-run] files=${filesChanged} replacements=${totalChanges}` : `[wrote] files=${filesChanged} replacements=${totalChanges}`)
}

main()
