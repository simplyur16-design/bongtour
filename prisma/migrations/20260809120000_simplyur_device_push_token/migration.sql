-- Simplyur mobile Expo push tokens
CREATE TABLE IF NOT EXISTS "SimplyurDevicePushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SimplyurDevicePushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SimplyurDevicePushToken_userId_token_key"
  ON "SimplyurDevicePushToken"("userId", "token");

CREATE INDEX IF NOT EXISTS "SimplyurDevicePushToken_userId_idx"
  ON "SimplyurDevicePushToken"("userId");

DO $$
BEGIN
  ALTER TABLE "SimplyurDevicePushToken"
    ADD CONSTRAINT "SimplyurDevicePushToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
