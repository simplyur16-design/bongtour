-- Rollback for 20261114185500_bongsim_payment_attempt_provider_session_uniq (manual, run only with owner approval).
-- GRANT/RLS: nothing to restore (the migration did not change either).
DROP INDEX IF EXISTS bongsim_payment_attempt_provider_session_uniq;
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20261114185500_bongsim_payment_attempt_provider_session_uniq';
