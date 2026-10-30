-- Rollback for 20261031010000_product_auto_register_block_reason (manual, run only with owner approval).
-- GRANT/RLS: nothing to restore (the migration did not change either).
ALTER TABLE "Product" DROP COLUMN IF EXISTS "autoRegisterCheckedAt";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "autoRegisterBlockReason";
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20261031010000_product_auto_register_block_reason';
