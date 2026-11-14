-- 결제 세션 번호(P_OID / provider_session_id) 중복 방지.
-- ADDITIVE ONLY: unique index on existing bongsim_payment_attempt columns.
-- GRANT/RLS: unchanged. Prisma schema has no PaymentAttempt model; SQL-only.
-- Precheck 2026-11-14 18:54 KST (Asia/Seoul): 0 duplicate (provider, provider_session_id) groups.

CREATE UNIQUE INDEX IF NOT EXISTS bongsim_payment_attempt_provider_session_uniq
  ON public.bongsim_payment_attempt (provider, provider_session_id)
  WHERE provider_session_id IS NOT NULL;
