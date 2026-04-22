ALTER TABLE public.travel_reviews ENABLE ROW LEVEL SECURITY;

-- 정책 4개 (travel_reviews_schema JSON의 rls_policies 기준)

CREATE POLICY travel_reviews_public_read_published
  ON public.travel_reviews
  FOR SELECT
  USING (status = 'published'::text);

CREATE POLICY travel_reviews_no_client_insert
  ON public.travel_reviews
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY travel_reviews_no_client_update
  ON public.travel_reviews
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY travel_reviews_no_client_delete
  ON public.travel_reviews
  FOR DELETE
  USING (false);
