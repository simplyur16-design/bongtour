import fs from 'node:fs/promises'
import path from 'node:path'
import { parseCsvRows } from '@/lib/csv-parse-minimal'
import { metaPurposeLabel, selectGroupMeetingDisplayTags } from '@/lib/group-meeting-review-tags'

export type GroupMeetingReviewCardModel = {
  id: string
  customer_type: string | null
  review_type: string
  purposeLabel: string
  destination_country: string | null
  destination_city: string | null
  dateLabel: string | null
  ratingLabel: string | null
  ratingValue: number | null
  title: string
  bodyLines: string
  displayTags: string[]
  thumbnail_url: string | null
}

function parseTagsCell(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  const t = raw.trim()
  if (t.startsWith('[')) {
    try {
      const j = JSON.parse(t) as unknown
      if (Array.isArray(j)) return j.map((x) => String(x).trim()).filter(Boolean)
    } catch {
      /* fall through */
    }
  }
  return t
    .split(',')
    .map((x) => x.replace(/^[\s#]+|[\s#]+$/g, '').trim())
    .filter(Boolean)
}

function formatDotDate(isoDate: string | null | undefined): string | null {
  if (!isoDate?.trim()) return null
  const d = new Date(`${isoDate.trim().slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

function formatTravelMonth(travelMonth: string | null | undefined): string | null {
  if (!travelMonth?.trim()) return null
  const ym = travelMonth.trim().slice(0, 7)
  const [y, m] = ym.split('-')
  if (!y || !m) return null
  return `${y}.${m.padStart(2, '0')}`
}

function parseRating(ratingLabel: string | null | undefined): number | null {
  if (!ratingLabel?.trim()) return null
  const n = Number.parseFloat(ratingLabel.replace(/[^\d.]/g, ''))
  if (Number.isNaN(n)) return null
  if (n < 4.7) return 4.7
  if (n > 5.0) return 5.0
  return Math.round(n * 10) / 10
}

function clipBody(excerpt: string, body: string | null, maxLen = 220): string {
  const ex = excerpt?.trim() ?? ''
  if (ex.length >= 40) return ex
  const b = body?.trim() ?? ''
  if (!b) return ex
  const use = ex || b
  if (use.length <= maxLen) return use
  return `${use.slice(0, maxLen).trim()}…`
}

export async function loadGroupMeetingReviewsFromCsv(): Promise<GroupMeetingReviewCardModel[]> {
  const fp = path.join(process.cwd(), 'data', 'bongtour_reviews.csv')
  let raw: string
  try {
    raw = await fs.readFile(fp, 'utf8')
  } catch {
    return []
  }
  const rows = parseCsvRows(raw)
  if (rows.length < 2) return []

  const header = rows[0]!.map((h) => h.trim())
  const idx = (name: string) => header.indexOf(name)

  const idI = idx('id')
  const statusI = idx('status')
  const titleI = idx('title')
  const excerptI = idx('excerpt')
  const bodyI = idx('body')
  const customerI = idx('customer_type')
  const countryI = idx('destination_country')
  const cityI = idx('destination_city')
  const tagsI = idx('tags')
  const travelMonthI = idx('travel_month')
  const displayedI = idx('displayed_date')
  const ratingI = idx('rating_label')
  const thumbI = idx('thumbnail_url')
  const reviewTypeI = idx('review_type')

  if (idI < 0 || titleI < 0) return []

  const out: GroupMeetingReviewCardModel[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!
    if (statusI >= 0 && (row[statusI]?.trim() ?? '') !== 'approved') continue

    const id = row[idI]?.trim()
    const title = row[titleI]?.trim()
    if (!id || !title) continue

    const tags = parseTagsCell(row[tagsI])
    const customer_type = row[customerI]?.trim() || null
    const destination_country = row[countryI]?.trim() || null
    const destination_city = row[cityI]?.trim() || null
    const review_type = row[reviewTypeI]?.trim() || 'small_group'
    const purposeLabel = metaPurposeLabel(tags, review_type)
    const dateLabel = formatDotDate(row[displayedI]) ?? formatTravelMonth(row[travelMonthI])
    const ratingLabel = row[ratingI]?.trim() || null
    const ratingValue = parseRating(ratingLabel)
    const bodyLines = clipBody(row[excerptI] ?? '', row[bodyI] ?? null)
    const displayTags = selectGroupMeetingDisplayTags({
      tags,
      customer_type,
      destination_country,
    })

    out.push({
      id,
      customer_type,
      review_type,
      purposeLabel,
      destination_country,
      destination_city,
      dateLabel,
      ratingLabel,
      ratingValue,
      title,
      bodyLines,
      displayTags,
      thumbnail_url: row[thumbI]?.trim() || null,
    })
  }
  return out
}
