-- =============================================================================
-- public.travel_reviews 레거시 정리 (정책·트리거·전용 함수·테이블만)
-- 다른 스키마/테이블/공용 함수는 건드리지 않음.
-- =============================================================================

drop policy if exists travel_reviews_select_published_only on public.travel_reviews;
drop policy if exists travel_reviews_select_published on public.travel_reviews;
drop policy if exists travel_reviews_public_read_published on public.travel_reviews;
drop policy if exists travel_reviews_public_select_published on public.travel_reviews;

drop trigger if exists travel_reviews_set_updated_at on public.travel_reviews;

drop function if exists public.travel_reviews_touch_updated_at();

drop table if exists public.travel_reviews cascade;
