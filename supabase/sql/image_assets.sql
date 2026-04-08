-- Supabase SQL Editor: public.image_assets
-- 프로젝트 URL 예: https://spuptilbzyxrvyyyheza.supabase.co
-- 서버는 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 만 사용 (service role 은 서버 전용).

create table if not exists public.image_assets (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  entity_name_kr text not null,
  entity_name_en text,
  supplier_name text,
  service_type text not null,
  image_role text not null,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  file_name text not null,
  file_ext text not null,
  mime_type text not null,
  storage_bucket text not null,
  storage_path text not null unique,
  public_url text not null,
  alt_kr text not null,
  alt_en text not null,
  title_kr text,
  title_en text,
  source_type text not null default 'photo_owned',
  source_name text,
  source_note text,
  is_generated boolean not null default false,
  seo_title_kr text,
  seo_title_en text,
  upload_status text not null default 'completed',
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sheet_sync_status text default 'pending',
  sheet_sync_error text,
  sheet_synced_at timestamptz
);

create index if not exists image_assets_entity_idx on public.image_assets (entity_type, entity_id);
create index if not exists image_assets_entity_role_idx on public.image_assets (entity_type, entity_id, image_role);
create index if not exists image_assets_sheet_sync_idx on public.image_assets (sheet_sync_status);

comment on table public.image_assets is '관리자 이미지 SSOT 메타; Storage 공개 URL과 함께 사용';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'image_assets_source_type_check'
  ) then
    alter table public.image_assets
      add constraint image_assets_source_type_check
      check (source_type in ('pexels', 'gemini_auto', 'gemini_manual', 'photo_owned', 'istock'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'image_assets' and column_name = 'source_name'
  ) then
    alter table public.image_assets add column source_name text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'image_assets' and column_name = 'seo_title_kr'
  ) then
    alter table public.image_assets add column seo_title_kr text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'image_assets' and column_name = 'seo_title_en'
  ) then
    alter table public.image_assets add column seo_title_en text;
  end if;
end $$;
