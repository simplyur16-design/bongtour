-- public.image_assets CHECK 확장 (Supabase에서 직접 반영한 제약과 동일하게 버전 관리).
--
-- 추가 값:
--   * entity_type_check  → bongsim_esim_country
--   * image_role_check   → recommend_hero
--   * source_type_check  → pexels
--   * upload_status_check → completed, skipped
--
-- 주의: CHECK는 값 집합 전체를 바꿔야 하므로 기존 제약 DROP 후 동일 이름으로 재생성한다.
--       기준: v1_init/03_image_assets_checks.sql + 위 확장 + 운영 source_type
--       (pexels·gemini_*·photo_owned·istock — lib/image-asset-source.ts, supabase/sql/image_assets.sql).

BEGIN;

ALTER TABLE public.image_assets DROP CONSTRAINT IF EXISTS image_assets_entity_type_check;
ALTER TABLE public.image_assets ADD CONSTRAINT image_assets_entity_type_check
  CHECK (
    entity_type = ANY (
      ARRAY[
        'product'::text,
        'city'::text,
        'country'::text,
        'study'::text,
        'bus'::text,
        'page'::text,
        'bongsim_esim_country'::text
      ]
    )
  );

ALTER TABLE public.image_assets DROP CONSTRAINT IF EXISTS image_assets_image_role_check;
ALTER TABLE public.image_assets ADD CONSTRAINT image_assets_image_role_check
  CHECK (
    image_role = ANY (
      ARRAY[
        'hero'::text,
        'thumb'::text,
        'gallery'::text,
        'og'::text,
        'recommend_hero'::text
      ]
    )
  );

ALTER TABLE public.image_assets DROP CONSTRAINT IF EXISTS image_assets_source_type_check;
ALTER TABLE public.image_assets ADD CONSTRAINT image_assets_source_type_check
  CHECK (
    source_type = ANY (
      ARRAY[
        'upload'::text,
        'generated'::text,
        'migrated'::text,
        'imported'::text,
        'pexels'::text,
        'gemini_auto'::text,
        'gemini_manual'::text,
        'photo_owned'::text,
        'istock'::text
      ]
    )
  );

ALTER TABLE public.image_assets DROP CONSTRAINT IF EXISTS image_assets_upload_status_check;
ALTER TABLE public.image_assets ADD CONSTRAINT image_assets_upload_status_check
  CHECK (
    upload_status = ANY (
      ARRAY[
        'success'::text,
        'failed'::text,
        'pending'::text,
        'sync_pending'::text,
        'completed'::text,
        'skipped'::text
      ]
    )
  );

COMMIT;
