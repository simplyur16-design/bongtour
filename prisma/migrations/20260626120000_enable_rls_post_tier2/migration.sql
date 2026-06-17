-- Tier 2 후속 — 4개 테이블 RLS 활성화 (Claude MCP로 이미 운영 적용됨)
-- 멱등성: 이미 적용된 환경에서도 안전하게 실행

ALTER TABLE "BongMetaConnection" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "BongMetaConnection";
CREATE POLICY "service_role_full_access" ON "BongMetaConnection"
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE "BongHookLearnConfig" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "BongHookLearnConfig";
CREATE POLICY "service_role_full_access" ON "BongHookLearnConfig"
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE "Product_pre_tier2_backup_20260617" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "Product_pre_tier2_backup_20260617";
CREATE POLICY "service_role_full_access" ON "Product_pre_tier2_backup_20260617"
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access" ON "_prisma_migrations";
CREATE POLICY "service_role_full_access" ON "_prisma_migrations"
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
