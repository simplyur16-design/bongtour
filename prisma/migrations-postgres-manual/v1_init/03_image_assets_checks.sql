-- image_assets CHECK 제약 (Supabase 백업 schema JSON 기준 10개)
-- 소스: backups/image_assets/schema_*.json → check_constraints

ALTER TABLE public.image_assets ADD CONSTRAINT "image_assets_alt_kr_not_blank" CHECK ((length(TRIM(BOTH FROM alt_kr)) > 0));
ALTER TABLE public.image_assets ADD CONSTRAINT "image_assets_entity_id_not_blank" CHECK ((length(TRIM(BOTH FROM entity_id)) > 0));
ALTER TABLE public.image_assets ADD CONSTRAINT "image_assets_entity_type_check" CHECK ((entity_type = ANY (ARRAY['product'::text, 'city'::text, 'country'::text, 'study'::text, 'bus'::text, 'page'::text])));
ALTER TABLE public.image_assets ADD CONSTRAINT "image_assets_file_name_not_blank" CHECK ((length(TRIM(BOTH FROM file_name)) > 0));
ALTER TABLE public.image_assets ADD CONSTRAINT "image_assets_image_role_check" CHECK ((image_role = ANY (ARRAY['hero'::text, 'thumb'::text, 'gallery'::text, 'og'::text])));
ALTER TABLE public.image_assets ADD CONSTRAINT "image_assets_public_url_not_blank" CHECK ((length(TRIM(BOTH FROM public_url)) > 0));
ALTER TABLE public.image_assets ADD CONSTRAINT "image_assets_service_type_check" CHECK ((service_type = ANY (ARRAY['overseas'::text, 'domestic'::text, 'study'::text, 'bus'::text, 'support'::text])));
ALTER TABLE public.image_assets ADD CONSTRAINT "image_assets_source_type_check" CHECK ((source_type = ANY (ARRAY['upload'::text, 'generated'::text, 'migrated'::text, 'imported'::text])));
ALTER TABLE public.image_assets ADD CONSTRAINT "image_assets_storage_path_not_blank" CHECK ((length(TRIM(BOTH FROM storage_path)) > 0));
ALTER TABLE public.image_assets ADD CONSTRAINT "image_assets_upload_status_check" CHECK ((upload_status = ANY (ARRAY['success'::text, 'failed'::text, 'pending'::text, 'sync_pending'::text])));
