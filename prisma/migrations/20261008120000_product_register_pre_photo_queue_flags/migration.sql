-- Travel Product only: denormalized register-pre-photo queue flags for admin KPI/list.
-- REGRESSION-FREEZE[admin-pending-queue-flags]: schema flags — manifest
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "registerPrePhotoQueueReady" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "registerPhotosReady" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Product_registrationStatus_registerPrePhotoQueueReady_idx"
  ON "Product" ("registrationStatus", "registerPrePhotoQueueReady");
