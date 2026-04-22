-- travel_reviews 인덱스 (PK travel_reviews_pkey 제외)
-- 소스: backups/travel_reviews/travel_reviews_schema_*.json → indexes

CREATE INDEX IF NOT EXISTS idx_travel_reviews_status_category_featured ON public.travel_reviews USING btree (status, category, is_featured);
CREATE INDEX IF NOT EXISTS idx_travel_reviews_displayed_date ON public.travel_reviews USING btree (displayed_date DESC);
CREATE INDEX IF NOT EXISTS idx_travel_reviews_user_id ON public.travel_reviews USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_travel_reviews_created_at ON public.travel_reviews USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_travel_reviews_display_order ON public.travel_reviews USING btree (display_order);
CREATE INDEX IF NOT EXISTS idx_travel_reviews_review_type ON public.travel_reviews USING btree (review_type);
