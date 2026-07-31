import { describe, expect, it } from "vitest";
import {
  ensurePrismaPgBouncerFlag,
  isTransactionPoolerUrl,
  rewriteSupabaseSessionPoolerToTransaction,
} from "@/lib/supabase-pooler-url";

describe("supabase-pooler-url", () => {
  it("rewrites session pooler :5432 to transaction :6543", () => {
    const inUrl =
      "postgresql://postgres.abc:secret@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";
    const out = rewriteSupabaseSessionPoolerToTransaction(inUrl);
    expect(out).toContain(":6543/");
    expect(out).not.toContain(":5432");
  });

  it("leaves direct db host on :5432 alone", () => {
    const inUrl = "postgresql://postgres:secret@db.abc.supabase.co:5432/postgres";
    expect(rewriteSupabaseSessionPoolerToTransaction(inUrl)).toBe(inUrl);
  });

  it("adds pgbouncer=true only for transaction pooler URLs", () => {
    const txn =
      "postgresql://postgres.abc:secret@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";
    expect(ensurePrismaPgBouncerFlag(txn)).toContain("pgbouncer=true");
    const direct = "postgresql://postgres:secret@db.abc.supabase.co:5432/postgres";
    expect(ensurePrismaPgBouncerFlag(direct)).toBe(direct);
  });

  it("detects transaction pooler port", () => {
    expect(isTransactionPoolerUrl("postgresql://u:p@h:6543/db")).toBe(true);
    expect(isTransactionPoolerUrl("postgresql://u:p@h:5432/db")).toBe(false);
  });
});
