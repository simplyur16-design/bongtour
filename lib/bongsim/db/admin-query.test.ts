import { describe, expect, it } from "vitest";
import { bongsimAdminQueryFailurePayload } from "@/lib/bongsim/db/admin-query";

// REGRESSION-FREEZE[bongsim-admin-payments-query]: admin query failure payload — manifest

describe("bongsimAdminQueryFailurePayload", () => {
  it("maps connect timeout to connection_timeout with Korean message", () => {
    const out = bongsimAdminQueryFailurePayload(
      new Error("timeout exceeded when trying to connect"),
    );
    expect(out.status).toBe(503);
    expect(out.body.error).toBe("connection_timeout");
    expect(out.body.message).toMatch(/DB 연결/);
  });

  it("maps other DB errors to query_failed with Korean message", () => {
    const out = bongsimAdminQueryFailurePayload(new Error("relation does not exist"));
    expect(out.status).toBe(500);
    expect(out.body.error).toBe("query_failed");
    expect(out.body.message).toMatch(/조회에 실패/);
  });

  it("maps db_unconfigured", () => {
    const out = bongsimAdminQueryFailurePayload(
      Object.assign(new Error("db_unconfigured"), { code: "db_unconfigured" }),
    );
    expect(out.status).toBe(503);
    expect(out.body.error).toBe("db_unconfigured");
  });
});
