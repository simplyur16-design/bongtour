-- bookable derived columns: exclude sold-out departures (seatCount 0, 마감/만석 status)

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
