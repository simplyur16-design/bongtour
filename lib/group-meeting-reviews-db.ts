import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { GroupMeetingReviewCardModel } from '@/lib/group-meeting-reviews-csv'
import { metaPurposeLabel, selectGroupMeetingDisplayTags } from '@/lib/group-meeting-review-tags'

/**
 * Supabase travel_reviews에서 published 상태의 리뷰를 GroupMeetingReviewCardModel로 반환.
 * 카드 뒤집기 UI용 (50개 순환).
 */
export async function loadGroupMeetingReviewsFromDb(): Promise<GroupMeetingReviewCardModel[]> {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('travel_reviews')
      .select(
        'id, customer_type, review_type, destination_country, destination_city, travel_month, displayed_date, rating_label, title, body, tags, thumbnail_url, status'
      )
      .eq('status', 'published')
      .order('displayed_date', { ascending: false, nullsFirst: false })
      .limit(100)

    if (error) {
      console.error('[group-meeting-reviews-db] Supabase error:', error)
      return []
    }

    if (!data || data.length === 0) {
      return []
    }

    return data.map((row: Record<string, unknown>): GroupMeetingReviewCardModel => {
      const tagsArray = Array.isArray(row.tags)
        ? (row.tags as string[])
        : typeof row.tags === 'string'
          ? tryParseJsonArray(row.tags)
          : []

      const reviewType = String(row.review_type ?? 'small_group')
      const purposeLabel = metaPurposeLabel(tagsArray, reviewType) || '여행후기'
      const displayTags = selectGroupMeetingDisplayTags({
        tags: tagsArray,
        customer_type: row.customer_type != null ? String(row.customer_type) : null,
        destination_country: row.destination_country != null ? String(row.destination_country) : null,
      })

      const ratingValue = parseRatingFromLabel(row.rating_label != null ? String(row.rating_label) : null)

      return {
        id: String(row.id ?? ''),
        customer_type: row.customer_type != null ? String(row.customer_type) : null,
        review_type: reviewType,
        purposeLabel,
        destination_country: row.destination_country != null ? String(row.destination_country) : null,
        destination_city: row.destination_city != null ? String(row.destination_city) : null,
        dateLabel: formatDateLabel(
          (row.displayed_date as string | null | undefined) || (row.travel_month as string | null | undefined) || null
        ),
        ratingLabel: row.rating_label != null ? String(row.rating_label) : null,
        ratingValue,
        title: row.title != null ? String(row.title) : '',
        bodyLines: row.body != null ? String(row.body) : '',
        displayTags,
        thumbnail_url: row.thumbnail_url != null ? String(row.thumbnail_url) : null,
      }
    })
  } catch (e) {
    console.error('[group-meeting-reviews-db] Exception:', e)
    return []
  }
}

function tryParseJsonArray(str: string): string[] {
  try {
    const parsed = JSON.parse(str) as unknown
    return Array.isArray(parsed) ? parsed.map((x) => String(x).trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

function formatDateLabel(date: string | Date | null): string | null {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function parseRatingFromLabel(ratingLabel: string | null): number | null {
  if (!ratingLabel?.trim()) return null
  const n = Number.parseFloat(ratingLabel.replace(/[^\d.]/g, ''))
  if (Number.isNaN(n)) return null
  if (n < 4.7) return 4.7
  if (n > 5.0) return 5.0
  return Math.round(n * 10) / 10
}
