import { describe, expect, it } from "vitest";
import { classifyBongsimPgError, isBongsimPgTlsHandshakeIssue } from "@/lib/bongsim/db/pool";

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

  it("treats Supabase session pool exhaustion as recoverable", () => {
    expect(
      classifyBongsimPgError(
        new Error(
          "FATAL: (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15",
        ),
      ),
    ).toBe("connection_timeout");
  });

  it("treats postgres 53300 too many connections as recoverable", () => {
    const err = Object.assign(new Error("sorry, too many clients already"), { code: "53300" });
    expect(classifyBongsimPgError(err)).toBe("connection_timeout");
  });

  it("defaults other errors to db_error", () => {
    expect(classifyBongsimPgError(new Error("relation does not exist"))).toBe("db_error");
  });
});

// REGRESSION-FREEZE[bongsim-pg-tls-global]: SELF_SIGNED_CERT_IN_CHAIN 감지 — manifest
describe("isBongsimPgTlsHandshakeIssue", () => {
  it("detects Supabase pooler self-signed chain", () => {
    const err = Object.assign(new Error("self-signed certificate in certificate chain"), {
      code: "SELF_SIGNED_CERT_IN_CHAIN",
    });
    expect(isBongsimPgTlsHandshakeIssue(err)).toBe(true);
  });

  it("ignores ordinary SQL errors", () => {
    expect(isBongsimPgTlsHandshakeIssue(new Error("relation does not exist"))).toBe(false);
  });
});
