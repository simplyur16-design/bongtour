import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetRegisterIngestEsimYieldSkipCountForTest,
  getRegisterIngestEsimYieldSkipCount,
  isRegisterListingIngestAllowedInThisProcess,
  isRegisterListingIngestCronEnabled,
  isRegisterPrePhotoHealOnlyCronEnabled,
  registerIngestNightMaxTotal,
  registerIngestShouldYieldToEsimSms,
  shouldRegisterRegisterListingIngestNightCron,
} from "@/lib/register-listing-ingest-cron-gate";
import { REGISTER_PRE_PHOTO_INGEST_OPERATOR_NIGHT_TOTAL } from "@/lib/register-pre-photo-ingest-night-window";
import {
  ESIM_QR_NOTIFY_FRESH_PENDING_SQL,
  esimQrNotifyPendingCountSql,
} from "@/lib/bongsim/fulfillment/esim-qr-notify-policy";

// REGRESSION-FREEZE[register-listing-ingest-opt-in]: default off — manifest
// REGRESSION-FREEZE[register-pre-photo-heal-cron-always]: heal independent of ingest — manifest

const countPendingEsimQrNotify = vi.fn();
const mainPoolQuery = vi.fn();

vi.mock("@/lib/bongsim/fulfillment/esim-qr-notify-outbox", () => ({
  countPendingEsimQrNotify: (...args: unknown[]) => countPendingEsimQrNotify(...args),
}));

vi.mock("@/lib/bongsim/db/pool", () => ({
  getPgPool: () => ({ query: (...args: unknown[]) => mainPoolQuery(...args) }),
}));

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

describe("night ingest process role + yield", () => {
  beforeEach(() => {
    delete process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST;
    delete process.env.REGISTER_INGEST_ALLOW_ON_WEB;
    delete process.env.REGISTER_INGEST_YIELD_TO_ESIM;
    delete process.env.REGISTER_INGEST_NIGHT_MAX_TOTAL;
    delete process.env.BONGSIM_ESIM_QR_NOTIFY_HOLD_AFTER_HOURS;
    __resetRegisterIngestEsimYieldSkipCountForTest();
    countPendingEsimQrNotify.mockReset();
    countPendingEsimQrNotify.mockResolvedValue(0);
    mainPoolQuery.mockReset();
    mainPoolQuery.mockRejectedValue(new Error("main pool down"));
  });

  it("role=web + ENABLE=1 → night ingest not registered", () => {
    process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST = "1";
    expect(isRegisterListingIngestAllowedInThisProcess("web")).toBe(false);
    expect(shouldRegisterRegisterListingIngestNightCron("web")).toBe(false);
  });

  it("role=worker + ENABLE=1 → night ingest registered", () => {
    process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST = "1";
    expect(isRegisterListingIngestAllowedInThisProcess("worker")).toBe(true);
    expect(shouldRegisterRegisterListingIngestNightCron("worker")).toBe(true);
  });

  it("ALLOW_ON_WEB=1 → web may register night ingest", () => {
    process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST = "1";
    process.env.REGISTER_INGEST_ALLOW_ON_WEB = "1";
    expect(shouldRegisterRegisterListingIngestNightCron("web")).toBe(true);
  });

  it("eSIM pending > 0 → yield skip", async () => {
    countPendingEsimQrNotify.mockResolvedValue(3);
    const r = await registerIngestShouldYieldToEsimSms();
    expect(r.skip).toBe(true);
    expect(r.pending).toBe(3);
    expect(getRegisterIngestEsimYieldSkipCount()).toBe(1);
  });

  it("eSIM query throw → safely skip", async () => {
    countPendingEsimQrNotify.mockRejectedValue(new Error("pool down"));
    const r = await registerIngestShouldYieldToEsimSms();
    expect(r.skip).toBe(true);
    expect(r.pending).toBe(-1);
    expect(getRegisterIngestEsimYieldSkipCount()).toBe(1);
  });

  it("outbox count ok does not touch the main pool", async () => {
    countPendingEsimQrNotify.mockResolvedValue(0);
    const r = await registerIngestShouldYieldToEsimSms();
    expect(r).toEqual({ skip: false, pending: 0 });
    expect(mainPoolQuery).not.toHaveBeenCalled();
    expect(getRegisterIngestEsimYieldSkipCount()).toBe(0);
  });

  it("outbox throw + main pool 0 does not skip", async () => {
    countPendingEsimQrNotify.mockRejectedValue(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));
    mainPoolQuery.mockResolvedValue({ rows: [{ n: 0 }] });
    const r = await registerIngestShouldYieldToEsimSms();
    expect(r).toEqual({ skip: false, pending: 0 });
    expect(mainPoolQuery).toHaveBeenCalledTimes(1);
    expect(String(mainPoolQuery.mock.calls[0]?.[0])).toBe(esimQrNotifyPendingCountSql());
    expect(String(mainPoolQuery.mock.calls[0]?.[0])).toContain(ESIM_QR_NOTIFY_FRESH_PENDING_SQL);
    expect(String(mainPoolQuery.mock.calls[0]?.[0])).not.toContain("UPDATE");
    expect(mainPoolQuery.mock.calls[0]?.[1]).toEqual(["EsimQrNotify", null]);
    expect(getRegisterIngestEsimYieldSkipCount()).toBe(0);
  });

  it("hold hours on: fallback passes the same age predicate and still does not write", async () => {
    process.env.BONGSIM_ESIM_QR_NOTIFY_HOLD_AFTER_HOURS = "48";
    countPendingEsimQrNotify.mockRejectedValue(new Error("outbox down"));
    mainPoolQuery.mockResolvedValue({ rows: [{ n: 0 }] });
    const r = await registerIngestShouldYieldToEsimSms();
    expect(r).toEqual({ skip: false, pending: 0 });
    expect(mainPoolQuery).toHaveBeenCalledTimes(1);
    const sql = String(mainPoolQuery.mock.calls[0]?.[0]);
    expect(sql).toBe(esimQrNotifyPendingCountSql());
    expect(sql).toContain("_outbox_hold");
    expect(sql).toContain("payload->>'_enqueued_at'");
    expect(sql).not.toContain("UPDATE");
    expect(sql).not.toContain("jsonb_set");
    expect(mainPoolQuery.mock.calls[0]?.[1]).toEqual(["EsimQrNotify", 48]);
    expect(getRegisterIngestEsimYieldSkipCount()).toBe(0);
  });

  it("outbox throw + main pool pending > 0 skips", async () => {
    countPendingEsimQrNotify.mockRejectedValue(new Error("outbox down"));
    mainPoolQuery.mockResolvedValue({ rows: [{ n: "4" }] });
    const r = await registerIngestShouldYieldToEsimSms();
    expect(r).toEqual({ skip: true, pending: 4 });
    expect(getRegisterIngestEsimYieldSkipCount()).toBe(1);
  });

  it("both counts throw → skip -1 and the log has no postgres URL", async () => {
    const secretUrl = "postgres://user:secret@db.example:5432/postgres?sslmode=require";
    countPendingEsimQrNotify.mockRejectedValue(
      Object.assign(new Error(`outbox ${secretUrl}`), { code: "ECONNREFUSED" }),
    );
    mainPoolQuery.mockRejectedValue(new Error(`main ${secretUrl}`));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const r = await registerIngestShouldYieldToEsimSms();
      expect(r).toEqual({ skip: true, pending: -1 });
      expect(getRegisterIngestEsimYieldSkipCount()).toBe(1);
      const line = warn.mock.calls.map((args) => args.map(String).join(" ")).join("\n");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(line).toContain("[register-ingest] esim yield count failed code=ECONNREFUSED");
      expect(line).not.toMatch(/postgres(?:ql)?:\/\//i);
      expect(line).not.toContain("secret");
      expect(line).not.toContain("db.example");
    } finally {
      warn.mockRestore();
    }
  });

  it("REGISTER_INGEST_YIELD_TO_ESIM=0 disables yield", async () => {
    process.env.REGISTER_INGEST_YIELD_TO_ESIM = "0";
    countPendingEsimQrNotify.mockResolvedValue(9);
    const r = await registerIngestShouldYieldToEsimSms();
    expect(r.skip).toBe(false);
    expect(countPendingEsimQrNotify).not.toHaveBeenCalled();
  });

  it("REGISTER_INGEST_NIGHT_MAX_TOTAL cannot exceed operator night total", () => {
    expect(registerIngestNightMaxTotal()).toBe(REGISTER_PRE_PHOTO_INGEST_OPERATOR_NIGHT_TOTAL);
    process.env.REGISTER_INGEST_NIGHT_MAX_TOTAL = "2";
    expect(registerIngestNightMaxTotal()).toBe(2);
    process.env.REGISTER_INGEST_NIGHT_MAX_TOTAL = "999";
    expect(registerIngestNightMaxTotal()).toBe(REGISTER_PRE_PHOTO_INGEST_OPERATOR_NIGHT_TOTAL);
  });
});
