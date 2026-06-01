-- add_product_bookable_derived_columns_and_trigger
-- Bookable = departureDate (Asia/Seoul calendar) >= (Seoul today + 2 days).
-- Aligns with lib/public-bookable-date.ts (+2 days); DB uses Asia/Seoul explicitly.

-- 1) Product derived columns
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "minBookableAdultPrice" INTEGER,
  ADD COLUMN IF NOT EXISTS "nextBookableDepartureAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bookableDepartureCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hasBookableDepartures" BOOLEAN NOT NULL DEFAULT false;

-- 2) Index for browse sort/filter (phase 2)
CREATE INDEX IF NOT EXISTS "Product_hasBookableDepartures_nextBookableDepartureAt_idx"
  ON "Product" ("hasBookableDepartures", "nextBookableDepartureAt");

-- 3) Per-product sync (called from trigger)
CREATE OR REPLACE FUNCTION fn_sync_product_bookable_derived(p_product_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_min_date DATE;
  v_min_adult INTEGER;
  v_min_dep TIMESTAMP(3);
  v_cnt INTEGER;
BEGIN
  v_min_date := ((NOW() AT TIME ZONE 'Asia/Seoul')::date + INTERVAL '2 days')::date;

  SELECT
    MIN(pd."adultPrice") FILTER (WHERE pd."adultPrice" IS NOT NULL AND pd."adultPrice" > 0),
    MIN(pd."departureDate"),
    COUNT(*)::int
  INTO v_min_adult, v_min_dep, v_cnt
  FROM "ProductDeparture" pd
  WHERE pd."productId" = p_product_id
    AND (pd."departureDate" AT TIME ZONE 'Asia/Seoul')::date >= v_min_date;

  UPDATE "Product"
  SET
    "minBookableAdultPrice" = v_min_adult,
    "nextBookableDepartureAt" = v_min_dep,
    "bookableDepartureCount" = COALESCE(v_cnt, 0),
    "hasBookableDepartures" = COALESCE(v_cnt, 0) > 0
  WHERE id = p_product_id;
END;
$$;

-- 4) Backfill all products
WITH bookable_min AS (
  SELECT ((NOW() AT TIME ZONE 'Asia/Seoul')::date + INTERVAL '2 days')::date AS d
),
agg AS (
  SELECT
    pd."productId",
    MIN(pd."adultPrice") FILTER (WHERE pd."adultPrice" IS NOT NULL AND pd."adultPrice" > 0) AS min_adult,
    MIN(pd."departureDate") AS min_dep,
    COUNT(*)::int AS cnt
  FROM "ProductDeparture" pd
  CROSS JOIN bookable_min bm
  WHERE (pd."departureDate" AT TIME ZONE 'Asia/Seoul')::date >= bm.d
  GROUP BY pd."productId"
)
UPDATE "Product" p
SET
  "minBookableAdultPrice" = a.min_adult,
  "nextBookableDepartureAt" = a.min_dep,
  "bookableDepartureCount" = a.cnt,
  "hasBookableDepartures" = (a.cnt > 0)
FROM agg a
WHERE p.id = a."productId";

WITH bookable_min AS (
  SELECT ((NOW() AT TIME ZONE 'Asia/Seoul')::date + INTERVAL '2 days')::date AS d
)
UPDATE "Product" p
SET
  "minBookableAdultPrice" = NULL,
  "nextBookableDepartureAt" = NULL,
  "bookableDepartureCount" = 0,
  "hasBookableDepartures" = false
WHERE NOT EXISTS (
  SELECT 1
  FROM "ProductDeparture" pd
  CROSS JOIN bookable_min bm
  WHERE pd."productId" = p.id
    AND (pd."departureDate" AT TIME ZONE 'Asia/Seoul')::date >= bm.d
);

-- 5) ProductDeparture trigger function
CREATE OR REPLACE FUNCTION trg_sync_product_bookable_derived()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM fn_sync_product_bookable_derived(OLD."productId");
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD."productId" IS DISTINCT FROM NEW."productId" THEN
      PERFORM fn_sync_product_bookable_derived(OLD."productId");
    END IF;
    PERFORM fn_sync_product_bookable_derived(NEW."productId");
    RETURN NEW;
  ELSE
    PERFORM fn_sync_product_bookable_derived(NEW."productId");
    RETURN NEW;
  END IF;
END;
$$;

-- 6) Trigger on ProductDeparture
DROP TRIGGER IF EXISTS trg_product_departure_sync_derived ON "ProductDeparture";
CREATE TRIGGER trg_product_departure_sync_derived
  AFTER INSERT OR UPDATE OR DELETE ON "ProductDeparture"
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_product_bookable_derived();
