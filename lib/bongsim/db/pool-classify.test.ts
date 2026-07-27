import { describe, expect, it } from "vitest";
import { classifyBongsimPgError } from "@/lib/bongsim/db/pool";

// REGRESSION-FREEZE[bongsim-catalog-list-perf]: classify connect timeout — manifest

describe("classifyBongsimPgError", () => {
  it("detects pg pool connect timeout", () => {
    expect(
      classifyBongsimPgError(new Error("timeout exceeded when trying to connect")),
    ).toBe("connection_timeout");
  });

  it("detects ECONNREFUSED", () => {
    const err = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    expect(classifyBongsimPgError(err)).toBe("connection_timeout");
  });

  it("defaults other errors to db_error", () => {
    expect(classifyBongsimPgError(new Error("relation does not exist"))).toBe("db_error");
  });
});
