-- 결제 세션 번호(P_OID / provider_session_id) 중복 방지.
-- 콜백이 provider + provider_session_id 로 LIMIT 1 조회하므로, 같은 밀리초 OID 충돌 시
-- 다른 주문이 잡히지 않게 한다.
-- NULL 세션은 인덱스에서 제외(여러 행의 NULL 허용). 운영 사전점검 2026-11-14 18:54 KST: 중복 0건.
-- 적용: `npx tsx scripts/bongsim-migrate.ts` 및 Railway predeploy `prisma migrate deploy`.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS bongsim_payment_attempt_provider_session_uniq
  ON public.bongsim_payment_attempt (provider, provider_session_id)
  WHERE provider_session_id IS NOT NULL;

COMMIT;
