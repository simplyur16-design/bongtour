-- image_assets 인덱스 (PK image_assets_pkey 제외 10개)
-- 소스: backups/image_assets/schema_*.json → indexes

-- Prisma postgres-init image_assets에는 created_at 없음 → updated_at 기준 (Supabase 백업과 컬럼 차이)
CREATE INDEX image_assets_updated_at_idx ON public.image_assets USING btree ("updated_at" DESC);
CREATE INDEX image_assets_entity_idx ON public.image_assets USING btree (entity_type, entity_id);
CREATE UNIQUE INDEX image_assets_entity_role_sort_uidx ON public.image_assets USING btree (entity_type, entity_id, image_role, sort_order);
CREATE UNIQUE INDEX image_assets_primary_one_per_role_uidx ON public.image_assets USING btree (entity_type, entity_id, image_role) WHERE ((is_primary = true) AND (image_role = ANY (ARRAY['hero'::text, 'thumb'::text, 'og'::text])));
CREATE UNIQUE INDEX image_assets_public_url_uidx ON public.image_assets USING btree (public_url);
CREATE INDEX image_assets_role_idx ON public.image_assets USING btree (image_role);
CREATE INDEX image_assets_service_type_idx ON public.image_assets USING btree (service_type);
CREATE UNIQUE INDEX image_assets_storage_path_uidx ON public.image_assets USING btree (storage_bucket, storage_path);
CREATE INDEX image_assets_supplier_idx ON public.image_assets USING btree (supplier_name);
CREATE INDEX image_assets_uploaded_at_idx ON public.image_assets USING btree (uploaded_at DESC);
