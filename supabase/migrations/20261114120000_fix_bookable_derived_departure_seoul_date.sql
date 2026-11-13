-- Product bookable derived — departureDate 를 서울 달력 날짜로 바르게 읽는다.
--
-- ProductDeparture."departureDate" 는 timestamp without time zone 이고, 수집 코드는 공급사 출발일을
-- UTC 자정 instant(예: '2026-11-14 00:00:00')로 저장한다. Node(lib/public-bookable-date.ts toSeoulYmd)는
-- 이 값을 UTC instant 로 읽어 서울 날짜(2026-11-14)로 본다.
-- 기존 함수의 (departureDate AT TIME ZONE 'Asia/Seoul')::date 는 값을 서울 현지시각으로 해석한 뒤
-- 세션 TZ(UTC)로 날짜를 잘라 하루 이른 날짜(2026-11-13)가 된다 → 예약 가능 창에서 하루 먼저 빠짐.
-- 변경: ((departureDate AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date — Node 와 같은 해석, 세션 TZ 무관.
-- 현재 DB 의 모든 행(00:00:00 저장)에서는 departureDate::date 와 같은 값이다.
--
-- 범위: fn_sync_product_bookable_derived 의 WHERE 비교 한 줄만. 집계 조건(가격·좌석·마감 문구)·트리거·테이블·컬럼·인덱스 변경 없음.
-- GRANT: 변경 없음. CREATE OR REPLACE 는 소유자(postgres)·EXECUTE 권한을 유지한다. 아래 GRANT 는 적용 전
--        조회한 기존 ACL({=X, postgres=X, anon=X, authenticated=X, service_role=X})을 그대로 다시 적은 것(유지 확인용)이다.
-- RLS: 변경 없음. "Product"·"ProductDeparture" 정책·ENABLE/DISABLE ROW LEVEL SECURITY 문 없음. SECURITY DEFINER 아님(기존과 동일).
-- 적용 후 공개 플래그는 출발일 행 변경(트리거) 또는 매일 KST 00:30 일괄 동기화(lib/product-bookable-derived-sync.ts)에서 다시 계산된다.
--
-- REGRESSION-FREEZE[bookable-derived-departure-seoul-date]: 출발일 서울 날짜 비교 — manifest

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
    AND ((pd."departureDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date >= v_min_date;

  UPDATE public."Product"
  SET
    "minBookableAdultPrice" = v_min_adult,
    "nextBookableDepartureAt" = v_min_dep,
    "bookableDepartureCount" = COALESCE(v_cnt, 0),
    "hasBookableDepartures" = COALESCE(v_cnt, 0) > 0
  WHERE id = p_product_id;
END;
$$;

-- 기존 GRANT 유지 (변경 없음 — 적용 전 ACL 과 동일)
GRANT EXECUTE ON FUNCTION public.fn_sync_product_bookable_derived(TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_sync_product_bookable_derived(TEXT) TO anon, authenticated, service_role;
