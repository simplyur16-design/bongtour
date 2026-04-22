-- travel_reviews CHECK 제약 (PRIMARY KEY 항목 제외 7개)
-- 소스: backups/travel_reviews/travel_reviews_schema_*.json → check_constraints

ALTER TABLE public.travel_reviews ADD CONSTRAINT "travel_reviews_category_check" CHECK ((category = ANY (ARRAY['overseas'::text, 'domestic'::text, 'training'::text])));
ALTER TABLE public.travel_reviews ADD CONSTRAINT "travel_reviews_displayed_date_min_check" CHECK (((displayed_date IS NULL) OR (displayed_date >= '2025-01-07'::date)));
ALTER TABLE public.travel_reviews ADD CONSTRAINT "travel_reviews_published_at_min_check" CHECK (((published_at IS NULL) OR (published_at >= '2025-01-06 15:00:00+00'::timestamp with time zone)));
ALTER TABLE public.travel_reviews ADD CONSTRAINT "travel_reviews_review_type_check" CHECK ((review_type = ANY (ARRAY['solo'::text, 'group_small'::text, 'group_corporate'::text, 'group_friends'::text, 'family'::text, 'parents'::text, 'hiking'::text])));
ALTER TABLE public.travel_reviews ADD CONSTRAINT "travel_reviews_source_type_check" CHECK ((source_type = ANY (ARRAY['customer_submitted'::text, 'manual_admin'::text, 'migrated'::text])));
ALTER TABLE public.travel_reviews ADD CONSTRAINT "travel_reviews_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'published'::text, 'rejected'::text, 'archived'::text])));
ALTER TABLE public.travel_reviews ADD CONSTRAINT "travel_reviews_travel_month_min_check" CHECK (((travel_month IS NULL) OR (travel_month >= '2025-01-07'::date)));
