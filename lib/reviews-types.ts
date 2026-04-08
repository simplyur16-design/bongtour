/**
 * public.travel_reviews — 타입 정의. SQL: supabase/sql/travel_reviews.sql
 */

export type ReviewCategory = 'overseas' | 'domestic' | 'training'

export type ReviewType =
  | 'solo'
  | 'group_small'
  | 'group_corporate'
  | 'group_friends'
  | 'family'
  | 'parents'
  | 'hiking'

export type ReviewStatus = 'pending' | 'published' | 'rejected' | 'archived'

export type ReviewSourceType = 'customer_submitted' | 'manual_admin' | 'migrated'

export type ReviewRow = {
  id: string
  user_id: string
  category: ReviewCategory
  review_type: ReviewType
  title: string
  excerpt: string
  body: string | null
  customer_type: string | null
  destination_country: string | null
  destination_city: string | null
  tags: string[]
  travel_month: string | null
  displayed_date: string | null
  rating_label: string | null
  thumbnail_url: string | null
  is_featured: boolean
  display_order: number
  status: ReviewStatus
  rejection_reason: string | null
  source_type: ReviewSourceType
  approved_at: string | null
  approved_by: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type ReviewMemberSubmitInput = {
  category: ReviewCategory
  review_type: ReviewType
  title: string
  excerpt: string
  body?: string | null
  customer_type?: string | null
  destination_country?: string | null
  destination_city?: string | null
  tags?: string[]
  travel_month?: string | null
  rating_label?: string | null
  thumbnail_url?: string | null
}

export type ReviewCardModel = Pick<
  ReviewRow,
  | 'id'
  | 'title'
  | 'excerpt'
  | 'review_type'
  | 'customer_type'
  | 'destination_country'
  | 'destination_city'
  | 'rating_label'
  | 'tags'
  | 'travel_month'
  | 'displayed_date'
  | 'thumbnail_url'
>
