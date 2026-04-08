-- =============================================================================
-- public.travel_reviews — 회원 후기(서버 API 전용 insert/update). 클라이언트 직접 쓰기 금지.
-- 적용: travel_reviews_drop_legacy.sql 실행 후 본 파일.
--
-- user_id / approved_by: NextAuth+Prisma User.id 는 cuid(text) → uuid 컬럼에 넣을 수 없어 text 사용.
-- =============================================================================

create table public.travel_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  category text not null default 'overseas',
  review_type text not null,
  title text not null,
  excerpt text not null,
  body text,
  customer_type text,
  destination_country text,
  destination_city text,
  tags text[] not null default '{}',
  travel_month date,
  displayed_date date,
  rating_label text,
  thumbnail_url text,
  is_featured boolean not null default false,
  display_order integer not null default 0,
  status text not null default 'pending',
  rejection_reason text,
  source_type text not null default 'customer_submitted',
  approved_at timestamptz,
  approved_by text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_reviews_category_check check (category in ('overseas', 'domestic', 'training')),
  constraint travel_reviews_review_type_check check (
    review_type in (
      'solo',
      'group_small',
      'group_corporate',
      'group_friends',
      'family',
      'parents',
      'hiking'
    )
  ),
  constraint travel_reviews_status_check check (status in ('pending', 'published', 'rejected', 'archived')),
  constraint travel_reviews_source_type_check check (source_type in ('customer_submitted', 'manual_admin', 'migrated')),
  constraint travel_reviews_travel_month_after_launch check (travel_month is null or travel_month >= date '2025-01-07'),
  constraint travel_reviews_displayed_date_after_launch check (displayed_date is null or displayed_date >= date '2025-01-07'),
  constraint travel_reviews_published_at_after_launch check (
    published_at is null or published_at >= timestamptz '2025-01-07 00:00:00+00'
  )
);

comment on table public.travel_reviews is '회원 후기; 공개는 published만. 운영 기준일 2025-01-07 이후 travel_month/displayed_date/published_at.';
comment on column public.travel_reviews.user_id is 'Prisma User.id (cuid).';
comment on column public.travel_reviews.approved_by is '관리자 User.id (cuid) 또는 추적용 문자열.';

create index travel_reviews_status_category_featured_idx
  on public.travel_reviews (status, category, is_featured);

create index travel_reviews_displayed_date_desc_idx
  on public.travel_reviews (displayed_date desc nulls last);

create index travel_reviews_user_id_idx on public.travel_reviews (user_id);

create index travel_reviews_created_at_desc_idx on public.travel_reviews (created_at desc);

create index travel_reviews_display_order_idx on public.travel_reviews (display_order);

create index travel_reviews_review_type_idx on public.travel_reviews (review_type);

-- updated_at (전용 함수 — 다른 테이블과 공유하지 않음)
create or replace function public.travel_reviews_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger travel_reviews_set_updated_at
  before update on public.travel_reviews
  for each row
  execute procedure public.travel_reviews_touch_updated_at();

alter table public.travel_reviews enable row level security;

-- anon/authenticated: published 만 읽기. INSERT/UPDATE/DELETE 정책 없음 → 직접 쓰기 불가.
create policy travel_reviews_select_published_only
  on public.travel_reviews
  for select
  to anon, authenticated
  using (status = 'published');

-- service_role 은 RLS 우회
