import { afterEach, describe, expect, it } from "vitest";
import { isRegisterListingIngestCronEnabled } from "@/lib/register-listing-ingest-cron-gate";

// REGRESSION-FREEZE[register-listing-ingest-opt-in]: default off — manifest

describe("isRegisterListingIngestCronEnabled", () => {
  const prevEnable = process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST;
  const prevDisable = process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON;

  afterEach(() => {
    if (prevEnable === undefined) delete process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST;
    else process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST = prevEnable;
    if (prevDisable === undefined) delete process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON;
    else process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON = prevDisable;
  });

  it("is off unless explicitly enabled", () => {
    delete process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST;
    delete process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON;
    expect(isRegisterListingIngestCronEnabled()).toBe(false);
  });

  it("turns on only with ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST=1", () => {
    process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST = "1";
    delete process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON;
    expect(isRegisterListingIngestCronEnabled()).toBe(true);
  });

  it("stays off when DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON=1", () => {
    process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST = "1";
    process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON = "1";
    expect(isRegisterListingIngestCronEnabled()).toBe(false);
  });
});
