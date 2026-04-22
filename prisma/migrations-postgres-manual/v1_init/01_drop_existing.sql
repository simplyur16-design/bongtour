-- travel_reviews + image_assets 제거
-- 실행 전 백업: backups/travel_reviews/, backups/image_assets/
-- 백업 확인 완료 후에만 실행

DROP TABLE IF EXISTS public.travel_reviews CASCADE;
DROP TABLE IF EXISTS public.image_assets CASCADE;
