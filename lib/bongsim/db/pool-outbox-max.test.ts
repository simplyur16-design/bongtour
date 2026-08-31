import { afterEach, describe, expect, it } from "vitest";
import { resolveBongsimOutboxPoolMax } from "@/lib/bongsim/db/pool";

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
