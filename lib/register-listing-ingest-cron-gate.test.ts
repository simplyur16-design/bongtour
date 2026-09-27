import { afterEach, describe, expect, it } from "vitest";
import {
  isRegisterListingIngestCronEnabled,
  isRegisterPrePhotoHealOnlyCronEnabled,
} from "@/lib/register-listing-ingest-cron-gate";

// REGRESSION-FREEZE[register-listing-ingest-opt-in]: default off — manifest
// REGRESSION-FREEZE[register-pre-photo-heal-cron-always]: heal independent of ingest — manifest

describe("isRegisterListingIngestCronEnabled", () => {
  const prevEnable = process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST;

  afterEach(() => {
    if (prevEnable === undefined) delete process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST;
    else process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST = prevEnable;
  });

  it("is off unless explicitly enabled", () => {
    delete process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST;
    expect(isRegisterListingIngestCronEnabled()).toBe(false);
  });

  it("turns on only with ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST=1", () => {
    process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST = "1";
    expect(isRegisterListingIngestCronEnabled()).toBe(true);
  });

  it("stays on even when heal cron is disabled", () => {
    process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST = "1";
    process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON = "1";
    expect(isRegisterListingIngestCronEnabled()).toBe(true);
    delete process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON;
  });
});

describe("isRegisterPrePhotoHealOnlyCronEnabled", () => {
  const prevDisable = process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON;
  const prevEnable = process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST;

  afterEach(() => {
    if (prevDisable === undefined) delete process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON;
    else process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON = prevDisable;
    if (prevEnable === undefined) delete process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST;
    else process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST = prevEnable;
  });

  it("is on by default (ingest off does not block heal)", () => {
    delete process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON;
    delete process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST;
    expect(isRegisterPrePhotoHealOnlyCronEnabled()).toBe(true);
    expect(isRegisterListingIngestCronEnabled()).toBe(false);
  });

  it("turns off only with DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON=1", () => {
    process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON = "1";
    expect(isRegisterPrePhotoHealOnlyCronEnabled()).toBe(false);
  });
});
