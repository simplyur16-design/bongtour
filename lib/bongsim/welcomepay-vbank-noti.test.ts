import { describe, expect, it } from "vitest";
import {
  isVbankDepositNoti,
  pickVbankNotiAmountKrw,
  pickVbankNotiOid,
  vbankNotiProviderEventId,
} from "@/lib/bongsim/welcomepay-vbank-noti";

describe("welcomepay-vbank-noti", () => {
  it("detects deposit notification", () => {
    expect(isVbankDepositNoti({ type_msg: "2", no_tid: "T1", amt_input: "10000" })).toBe(true);
    expect(isVbankDepositNoti({ type_msg: "1" })).toBe(false);
    expect(isVbankDepositNoti({ no_tid: "T1", amt_input: "5000" })).toBe(true);
  });

  it("parses oid and amount", () => {
    expect(pickVbankNotiOid({ no_oid: "MID_1" })).toBe("MID_1");
    expect(pickVbankNotiAmountKrw({ P_AMT: "12000" })).toBe(12000);
  });

  it("builds stable provider event id", () => {
    expect(
      vbankNotiProviderEventId({ no_tid: "TID1", dt_input: "20260101", tm_input: "120000" }),
    ).toContain("TID1");
  });
});
