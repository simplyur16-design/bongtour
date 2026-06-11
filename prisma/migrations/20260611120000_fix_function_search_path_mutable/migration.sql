-- Supabase / Postgres linter: function search_path mutable
-- Mirror: supabase/migrations/20260611120000_fix_function_search_path_mutable.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS func
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'check_mega_menu_card_mapping',
        'set_updated_at',
        'sync_primary_product_country_tag',
        'fn_sync_product_bookable_derived',
        'trg_sync_product_bookable_derived'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.func);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_primary_product_country_tag()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW."registrationStatus" IS DISTINCT FROM 'registered' THEN
    RETURN NEW;
  END IF;

  IF NEW."countryKey" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public."Country" WHERE "countryKey" = NEW."countryKey") THEN
    RETURN NEW;
  END IF;

  UPDATE public."ProductCountryTag"
  SET "isPrimary" = false
  WHERE "productId" = NEW."id"
    AND "countryKey" != NEW."countryKey"
    AND "isPrimary" = true;

  INSERT INTO public."ProductCountryTag" ("id", "productId", "countryKey", "isPrimary", "sortOrder", "createdAt")
  VALUES (gen_random_uuid()::text, NEW."id", NEW."countryKey", true, 0, NOW())
  ON CONFLICT ("productId", "countryKey")
  DO UPDATE SET "isPrimary" = true, "sortOrder" = 0;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_product_bookable_derived(p_product_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_min_date DATE;
  v_min_adult INTEGER;
  v_min_dep TIMESTAMP(3);
  v_cnt INTEGER;
BEGIN
  v_min_date := ((NOW() AT TIME ZONE 'Asia/Seoul')::date + INTERVAL '2 days')::date;

  SELECT
    MIN(pd."adultPrice") FILTER (
      WHERE pd."adultPrice" IS NOT NULL
        AND pd."adultPrice" > 0
        AND (pd."isBookable" IS DISTINCT FROM false)
        AND (pd."seatCount" IS NULL OR pd."seatCount" > 0)
        AND NOT (
          COALESCE(pd."statusRaw", '') ~* '마감|만석|매진|판매\s*완료|판매\s*종료'
          OR COALESCE(pd."seatsStatusRaw", '') ~* '마감|만석|매진|잔여\s*0'
        )
    ),
    MIN(pd."departureDate") FILTER (
      WHERE pd."adultPrice" IS NOT NULL
        AND pd."adultPrice" > 0
        AND (pd."isBookable" IS DISTINCT FROM false)
        AND (pd."seatCount" IS NULL OR pd."seatCount" > 0)
        AND NOT (
          COALESCE(pd."statusRaw", '') ~* '마감|만석|매진|판매\s*완료|판매\s*종료'
          OR COALESCE(pd."seatsStatusRaw", '') ~* '마감|만석|매진|잔여\s*0'
        )
    ),
    COUNT(*) FILTER (
      WHERE pd."adultPrice" IS NOT NULL
        AND pd."adultPrice" > 0
        AND (pd."isBookable" IS DISTINCT FROM false)
        AND (pd."seatCount" IS NULL OR pd."seatCount" > 0)
        AND NOT (
          COALESCE(pd."statusRaw", '') ~* '마감|만석|매진|판매\s*완료|판매\s*종료'
          OR COALESCE(pd."seatsStatusRaw", '') ~* '마감|만석|매진|잔여\s*0'
        )
    )::int
  INTO v_min_adult, v_min_dep, v_cnt
  FROM public."ProductDeparture" pd
  WHERE pd."productId" = p_product_id
    AND (pd."departureDate" AT TIME ZONE 'Asia/Seoul')::date >= v_min_date;

  UPDATE public."Product"
  SET
    "minBookableAdultPrice" = v_min_adult,
    "nextBookableDepartureAt" = v_min_dep,
    "bookableDepartureCount" = COALESCE(v_cnt, 0),
    "hasBookableDepartures" = COALESCE(v_cnt, 0) > 0
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_product_bookable_derived()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.fn_sync_product_bookable_derived(OLD."productId");
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD."productId" IS DISTINCT FROM NEW."productId" THEN
      PERFORM public.fn_sync_product_bookable_derived(OLD."productId");
    END IF;
    PERFORM public.fn_sync_product_bookable_derived(NEW."productId");
    RETURN NEW;
  ELSE
    PERFORM public.fn_sync_product_bookable_derived(NEW."productId");
    RETURN NEW;
  END IF;
END;
$$;
