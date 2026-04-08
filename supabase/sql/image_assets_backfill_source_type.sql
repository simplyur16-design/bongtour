-- image_assets source_type / source_name / is_generated 백필 초안
-- 실행 전:
-- 1) 운영 DB 백업
-- 2) where 절 샘플 select로 영향 범위 검증
-- 3) 필요 시 트랜잭션으로 묶어서 실행

begin;

-- 0) 최소 안전장치: null 값 기본 보정
update public.image_assets
set source_type = coalesce(nullif(trim(source_type), ''), 'photo_owned'),
    source_name = coalesce(nullif(trim(source_name), ''), 'Owned Photo'),
    is_generated = coalesce(is_generated, false)
where source_type is null
   or trim(source_type) = ''
   or source_name is null
   or trim(source_name) = ''
   or is_generated is null;

-- 1) 파일명 iStock- 접두 자동 보정 (최우선)
update public.image_assets
set source_type = 'istock',
    source_name = 'iStock',
    is_generated = false
where file_name ilike 'iStock-%';

-- 2) 자동 생성 자산(gemini_auto) 후보
-- TODO: 실제 자동 생성 경로/업로더 규칙을 운영 데이터에 맞게 보강
update public.image_assets
set source_type = 'gemini_auto',
    source_name = 'Gemini Auto',
    is_generated = true
where source_type not in ('istock')
  and (
    coalesce(source_note, '') ilike '%auto generated gemini%'
    or coalesce(source_note, '') ilike '%gemini auto%'
  );

-- 3) 자동 수집 자산(pexels) 후보
-- TODO: 실제 파이프라인 식별자(업로더/노트/경로 prefix) 기준으로 보강
update public.image_assets
set source_type = 'pexels',
    source_name = 'Pexels',
    is_generated = false
where source_type not in ('istock', 'gemini_auto')
  and (
    coalesce(source_note, '') ilike '%pexels%'
    or coalesce(uploaded_by, '') ilike '%process-images%'
  );

-- 4) 수동 업로드의 기본값 보정
update public.image_assets
set source_type = 'photo_owned',
    source_name = 'Owned Photo',
    is_generated = false
where source_type not in ('istock', 'gemini_auto', 'pexels', 'gemini_manual', 'photo_owned');

-- 5) source_name + is_generated 정합성 강제
update public.image_assets
set source_name = case source_type
    when 'pexels' then 'Pexels'
    when 'gemini_auto' then 'Gemini Auto'
    when 'gemini_manual' then 'Gemini Manual'
    when 'photo_owned' then 'Owned Photo'
    when 'istock' then 'iStock'
    else source_name
  end,
  is_generated = case
    when source_type in ('gemini_auto', 'gemini_manual') then true
    else false
  end
where source_name is distinct from (
    case source_type
      when 'pexels' then 'Pexels'
      when 'gemini_auto' then 'Gemini Auto'
      when 'gemini_manual' then 'Gemini Manual'
      when 'photo_owned' then 'Owned Photo'
      when 'istock' then 'iStock'
      else source_name
    end
  )
  or is_generated is distinct from (
    case when source_type in ('gemini_auto', 'gemini_manual') then true else false end
  );

commit;

-- 검증 쿼리
-- select source_type, source_name, is_generated, count(*) from public.image_assets group by 1,2,3 order by 1,2,3;
