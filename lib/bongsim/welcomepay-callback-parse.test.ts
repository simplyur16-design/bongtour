import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  parseWelcomepayPayload,
  pickOid,
  readWelcomepayCallbackFromRequest,
} from "@/lib/bongsim/welcomepay-callback-parse";

describe("welcomepay-callback-parse", () => {
  it("pickOid — PC orderNumber", () => {
    expect(pickOid({ orderNumber: "MID_1710000000000" })).toBe("MID_1710000000000");
  });

  it("pickOid — 모바일 P_OID·P_NOTI", () => {
    expect(pickOid({ P_OID: "MID_1710000000001" })).toBe("MID_1710000000001");
    expect(pickOid({ p_noti: "MID_1710000000002" })).toBe("MID_1710000000002");
  });

  it("parseWelcomepayPayload — urlencoded", () => {
    expect(parseWelcomepayPayload("P_OID=MID_1&P_STATUS=00")).toEqual({
      P_OID: "MID_1",
      P_STATUS: "00",
    });
  });

  it("readWelcomepayCallbackFromRequest — GET 쿼리 (PG 콜백 파라미터)", async () => {
    const req = new Request(
      "https://bongtour.com/api/bongsim/checkout/welcomepay-mobile-next?P_OID=MID_q1&P_NOTI=MID_q1",
      { method: "GET" },
    );
    const m = await readWelcomepayCallbackFromRequest(req);
    expect(pickOid(m)).toBe("MID_q1");
  });

  it("readWelcomepayCallbackFromRequest — GET 쿼리 + 본문 병합", async () => {
    const req = new Request("https://bongtour.com/api/cb?P_OID=MID_q1&P_AMT=10000", { method: "GET" });
    const m = await readWelcomepayCallbackFromRequest(req);
    expect(pickOid(m)).toBe("MID_q1");
    expect(m.P_AMT).toBe("10000");
  });

  it("readWelcomepayCallbackFromRequest — POST urlencoded", async () => {
    const req = new Request("https://bongtour.com/api/cb", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: "P_OID=MID_post1&P_NOTI=MID_post1&P_STATUS=00",
    });
    const m = await readWelcomepayCallbackFromRequest(req);
    expect(pickOid(m)).toBe("MID_post1");
  });

  it("readWelcomepayCallbackFromRequest — POST multipart", async () => {
    const fd = new FormData();
    fd.set("P_OID", "MID_multi1");
    fd.set("P_TID", "tid-abc");
    const req = new Request("https://bongtour.com/api/cb", { method: "POST", body: fd });
    const m = await readWelcomepayCallbackFromRequest(req);
    expect(pickOid(m)).toBe("MID_multi1");
    expect(m.P_TID).toBe("tid-abc");
  });
});
