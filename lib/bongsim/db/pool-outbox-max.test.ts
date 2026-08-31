import { afterEach, describe, expect, it } from "vitest";
import {
  resolveBongsimCatalogPoolMax,
  resolveBongsimOutboxPoolMax,
  resolveBongsimOutboxPoolMaxClamped,
  resolveBongsimPoolMax,
} from "@/lib/bongsim/db/pool";

// REGRESSION-FREEZE[bongsim-fulfill-outbox-own-pool]: outbox pool max — manifest

describe("resolveBongsimOutboxPoolMax", () => {
  const prev = process.env.BONGSIM_OUTBOX_POOL_MAX;

  afterEach(() => {
    if (prev === undefined) delete process.env.BONGSIM_OUTBOX_POOL_MAX;
    else process.env.BONGSIM_OUTBOX_POOL_MAX = prev;
  });

  it("defaults to 2 so catalog saturation cannot starve drain", () => {
    delete process.env.BONGSIM_OUTBOX_POOL_MAX;
    expect(resolveBongsimOutboxPoolMax()).toBe(2);
  });

  it("accepts 1–4 and ignores out-of-range", () => {
    process.env.BONGSIM_OUTBOX_POOL_MAX = "3";
    expect(resolveBongsimOutboxPoolMax()).toBe(3);
    process.env.BONGSIM_OUTBOX_POOL_MAX = "99";
    expect(resolveBongsimOutboxPoolMax()).toBe(2);
  });
});

describe("catalog + outbox stay inside BONGSIM_PG_POOL_MAX", () => {
  const prevTotal = process.env.BONGSIM_PG_POOL_MAX;
  const prevOut = process.env.BONGSIM_OUTBOX_POOL_MAX;

  afterEach(() => {
    if (prevTotal === undefined) delete process.env.BONGSIM_PG_POOL_MAX;
    else process.env.BONGSIM_PG_POOL_MAX = prevTotal;
    if (prevOut === undefined) delete process.env.BONGSIM_OUTBOX_POOL_MAX;
    else process.env.BONGSIM_OUTBOX_POOL_MAX = prevOut;
  });

  it("web 10 splits to 8+2", () => {
    process.env.BONGSIM_PG_POOL_MAX = "10";
    delete process.env.BONGSIM_OUTBOX_POOL_MAX;
    expect(resolveBongsimCatalogPoolMax()).toBe(8);
    expect(resolveBongsimOutboxPoolMaxClamped()).toBe(2);
    expect(resolveBongsimCatalogPoolMax() + resolveBongsimOutboxPoolMaxClamped()).toBe(
      resolveBongsimPoolMax(),
    );
  });

  it("worker 4 splits to 2+2", () => {
    process.env.BONGSIM_PG_POOL_MAX = "4";
    delete process.env.BONGSIM_OUTBOX_POOL_MAX;
    expect(resolveBongsimCatalogPoolMax() + resolveBongsimOutboxPoolMaxClamped()).toBe(4);
  });
});
