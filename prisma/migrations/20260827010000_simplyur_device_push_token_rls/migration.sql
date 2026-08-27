-- Expo device tokens are server-only (Prisma). PostgREST anon must not read `token`.
-- Do not FORCE RLS: Prisma connects as postgres and must keep working.

ALTER TABLE "SimplyurDevicePushToken" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON "SimplyurDevicePushToken";
CREATE POLICY "service_role_full_access" ON "SimplyurDevicePushToken"
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE "SimplyurDevicePushToken" FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE "SimplyurDevicePushToken" TO postgres, service_role;
