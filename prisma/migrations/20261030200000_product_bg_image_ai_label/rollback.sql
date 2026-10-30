-- Rollback for 20261030200000_product_bg_image_ai_label (manual, run only with owner approval).
-- Drops only the two columns this migration added. RLS/REVOKE/GRANT are left as is (they were the intended lock state).
-- After running, also remove the row from _prisma_migrations if the migration must be re-applied:
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20261030200000_product_bg_image_ai_label';
BEGIN;
ALTER TABLE "Product" DROP COLUMN IF EXISTS "bgImageAiLabeledAt";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "bgImageAiPrompt";
COMMIT;
