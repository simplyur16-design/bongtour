/**
 * Supabase public.travel_reviews 를 CSV 로 교체 (service role).
 * dry-run 기본, --apply 시 백업 후 삭제·삽입.
 *
 *   npx tsx scripts/replace-travel-reviews-from-csv.ts
 *   npx tsx scripts/replace-travel-reviews-from-csv.ts --apply
 *   npx tsx scripts/replace-travel-reviews-from-csv.ts --apply --csv "C:\\path\\file.csv"
 */
import './load-env-for-scripts'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import type { ReviewCategory, ReviewSourceType, ReviewStatus, ReviewType } from '../lib/reviews-types'

const TABLE = 'travel_reviews' as const

const ALLOWED_REVIEW_TYPES = new Set<ReviewType>([
  'solo',
  'group_small',
  'group_corporate',
  'group_friends',
  'family',
  'parents',
  'hiking',
])

/** CSV 에만 있고 DB check 제약에 없는 값 → 스키마 허용값으로 매핑 (supabase/sql/travel_reviews.sql) */
const REVIEW_TYPE_FROM_CSV: Record<string, ReviewType> = {
  couple: 'group_friends',
  friends: 'group_friends',
  relaxation: 'solo',
  adventure: 'hiking',
  foodie: 'solo',
  art: 'solo',
  activity: 'hiking',
}

function normalizeReviewType(raw: string): ReviewType {
  const t = raw.trim()
  if (ALLOWED_REVIEW_TYPES.has(t as ReviewType)) return t as ReviewType
  const mapped = REVIEW_TYPE_FROM_CSV[t]
  if (mapped) return mapped
  console.warn(`[replace-travel-reviews] unknown review_type "${t}" -> solo`)
  return 'solo'
}

function normalizeStatus(raw: string): ReviewStatus {
  const s = raw.trim().toLowerCase()
  if (s === 'approved') return 'published'
  if (s === 'pending' || s === 'published' || s === 'rejected' || s === 'archived') return s as ReviewStatus
  console.warn(`[replace-travel-reviews] unknown status "${raw}" -> published`)
  return 'published'
}

function parseCsv(content: string): string[][] {
  const lines: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false
  const s = content.replace(/^\uFEFF/, '')
  while (i < s.length) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      lines.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }
  const endsWithNl = s.endsWith('\n') || s.endsWith('\r\n')
  if (!endsWithNl && (field.length > 0 || row.length > 0)) {
    row.push(field)
    lines.push(row)
  }
  return lines
}

function parseBool(s: string): boolean {
  const t = s.trim().toLowerCase()
  return t === 'true' || t === '1' || t === 'yes'
}

function nullIfEmpty(s: string | undefined): string | null {
  if (s == null) return null
  const t = s.trim()
  return t === '' ? null : t
}

function parseTags(cell: string): string[] {
  const t = cell.trim()
  if (!t) return []
  try {
    const j = JSON.parse(t) as unknown
    if (Array.isArray(j)) return j.map((x) => String(x)).filter(Boolean)
  } catch {
    /* fallthrough */
  }
  return t
    .split(',')
    .map((x) => x.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

function parseIsoTs(s: string): string | null {
  const t = s.trim()
  if (!t) return null
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(t)
  if (m) return `${m[1]}T${m[2]}${m[3] || ''}Z`
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return t.endsWith('Z') ? t : `${t}Z`
  const d = Date.parse(t)
  if (!Number.isNaN(d)) return new Date(d).toISOString()
  return t
}

function parseDateOnly(s: string): string | null {
  const t = nullIfEmpty(s)
  if (!t) return null
  return t.slice(0, 10)
}

/** DB가 uuid 타입이면 "admin" 등 문자열은 거부됨 → UUID 형식만 통과, 나머지는 null */
function parseApprovedBy(s: string | undefined): string | null {
  const t = nullIfEmpty(s)
  if (!t) return null
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) return t
  console.warn(`[replace-travel-reviews] approved_by 비UUID "${t.slice(0, 20)}…" -> null`)
  return null
}

type CsvRow = Record<string, string>

function rowsToObjects(header: string[], rows: string[][]): CsvRow[] {
  const out: CsvRow[] = []
  for (const r of rows) {
    if (r.length === 1 && r[0] === '') continue
    const o: CsvRow = {}
    header.forEach((h, idx) => {
      o[h] = r[idx] ?? ''
    })
    out.push(o)
  }
  return out
}

function csvRowToDb(row: CsvRow, lineIndex: number): Record<string, unknown> {
  const rawType = row.review_type ?? ''
  const review_type = normalizeReviewType(rawType)
  if (rawType.trim() && review_type !== rawType.trim() && ALLOWED_REVIEW_TYPES.has(rawType.trim() as ReviewType) === false) {
    console.log(`[replace-travel-reviews] row ${lineIndex}: review_type "${rawType.trim()}" -> "${review_type}"`)
  }
  const rawStatus = row.status ?? ''
  const status = normalizeStatus(rawStatus)
  if (rawStatus.trim().toLowerCase() === 'approved') {
    console.log(`[replace-travel-reviews] row ${lineIndex}: status "approved" -> "published"`)
  }

  const category = (row.category.trim() || 'overseas') as ReviewCategory
  const source_type = (row.source_type?.trim() || 'manual_admin') as ReviewSourceType

  return {
    id: row.id.trim(),
    user_id: row.user_id.trim(),
    category,
    review_type,
    title: row.title.trim(),
    excerpt: row.excerpt.trim(),
    body: nullIfEmpty(row.body),
    customer_type: nullIfEmpty(row.customer_type),
    destination_country: nullIfEmpty(row.destination_country),
    destination_city: nullIfEmpty(row.destination_city),
    tags: parseTags(row.tags ?? ''),
    travel_month: parseDateOnly(row.travel_month ?? ''),
    displayed_date: parseDateOnly(row.displayed_date ?? ''),
    rating_label: nullIfEmpty(row.rating_label),
    thumbnail_url: nullIfEmpty(row.thumbnail_url),
    is_featured: parseBool(row.is_featured ?? 'false'),
    display_order: Number.parseInt(row.display_order ?? '0', 10) || 0,
    status,
    rejection_reason: nullIfEmpty(row.rejection_reason),
    source_type,
    approved_at: parseIsoTs(row.approved_at ?? ''),
    approved_by: parseApprovedBy(row.approved_by),
    published_at: parseIsoTs(row.published_at ?? ''),
    created_at: parseIsoTs(row.created_at ?? '') ?? new Date().toISOString(),
    updated_at: parseIsoTs(row.updated_at ?? '') ?? new Date().toISOString(),
  }
}

function getServiceRole(): ReturnType<typeof createClient> {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function defaultCsvPath(): string {
  const fromEnv = process.env.TRAVEL_REVIEWS_CSV_PATH?.trim()
  if (fromEnv) return fromEnv
  return join(homedir(), 'Downloads', 'travel_reviews_updated.csv')
}

function parseArgs(): { apply: boolean; csvPath: string } {
  const argv = process.argv.slice(2)
  const apply = argv.includes('--apply')
  const idx = argv.indexOf('--csv')
  const csvPath = idx >= 0 && argv[idx + 1] ? argv[idx + 1]!.replace(/^["']|["']$/g, '') : defaultCsvPath()
  return { apply, csvPath }
}

async function main(): Promise<void> {
  const { apply, csvPath } = parseArgs()
  console.log('[replace-travel-reviews] mode:', apply ? 'APPLY' : 'dry-run')
  console.log('[replace-travel-reviews] csv:', csvPath)

  const raw = readFileSync(csvPath, 'utf8')
  const table = parseCsv(raw)
  if (table.length < 2) throw new Error('CSV 헤더 없음 또는 비어 있음')
  const header = table[0]!.map((h) => h.trim())
  const dataRows = table.slice(1).filter((r) => r.some((c) => c.trim() !== ''))
  const objects = rowsToObjects(header, dataRows)
  const dbRows = objects.map((o, i) => csvRowToDb(o, i + 2))

  console.log('[replace-travel-reviews] parsed rows:', dbRows.length)

  const supabase = getServiceRole()

  const { count: beforeCount, error: countErr } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
  if (countErr) throw new Error(`count: ${countErr.message}`)
  console.log('[replace-travel-reviews] current table rows:', beforeCount ?? 'unknown')

  if (!apply) {
    console.log('[replace-travel-reviews] dry-run: no backup/insert/delete. --apply 로 실행.')
    dbRows.slice(0, 3).forEach((r, i) => {
      console.log(`[replace-travel-reviews] sample ${i + 1}:`, {
        id: r.id,
        title: String(r.title).slice(0, 40),
        status: r.status,
        review_type: r.review_type,
        tags: r.tags,
      })
    })
    return
  }

  const { data: backupData, error: backupErr } = await supabase.from(TABLE).select('*')
  if (backupErr) throw new Error(`backup select: ${backupErr.message}`)

  const dir = join(process.cwd(), 'backups')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupPath = join(dir, `travel_reviews_backup_${stamp}.json`)
  writeFileSync(backupPath, JSON.stringify(backupData ?? [], null, 2), 'utf8')
  console.log('[replace-travel-reviews] backup written:', backupPath)

  const { error: delErr } = await supabase.from(TABLE).delete().gte('created_at', '1970-01-01T00:00:00Z')
  if (delErr) throw new Error(`delete: ${delErr.message}`)

  const { error: insErr } = await supabase.from(TABLE).insert(dbRows as never[])
  if (insErr) throw new Error(`insert: ${insErr.message}`)

  const { count: afterCount, error: afterErr } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
  if (afterErr) console.warn('[replace-travel-reviews] post count:', afterErr.message)
  else console.log('[replace-travel-reviews] final row count:', afterCount)

  const { data: sample } = await supabase.from(TABLE).select('*').limit(3)
  console.log('[replace-travel-reviews] sample (first 3):', JSON.stringify(sample ?? [], null, 2))

  const { data: statusRows } = await supabase.from(TABLE).select('status')
  const { data: featRows } = await supabase.from(TABLE).select('is_featured')
  const statusDist: Record<string, number> = {}
  for (const r of statusRows ?? []) {
    const s = String((r as { status?: string }).status ?? '')
    statusDist[s] = (statusDist[s] ?? 0) + 1
  }
  const featured = (featRows ?? []).filter((r) => (r as { is_featured?: boolean }).is_featured === true).length
  console.log('[replace-travel-reviews] inserted:', dbRows.length)
  console.log('[replace-travel-reviews] status distribution:', statusDist)
  console.log('[replace-travel-reviews] is_featured true count:', featured)
  console.log('[replace-travel-reviews] done.')
}

main().catch((e) => {
  console.error('[replace-travel-reviews] fatal:', e)
  process.exit(1)
})
