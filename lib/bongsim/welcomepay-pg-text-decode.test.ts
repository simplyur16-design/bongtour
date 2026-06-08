import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import {
  decodeWelcomepayPgTextFromEucKr,
  looksLikeWelcomepayMojibake,
  normalizeWelcomepayPgUserMessage,
} from "@/lib/bongsim/welcomepay-pg-text-decode";

describe("welcomepay-pg-text-decode", () => {
  it("decodes EUC-KR bytes misread as latin1", () => {
    const plain = "사용자가 결제를 취소하였습니다.";
    const euc = iconv.encode(plain, "euc-kr");
    const garbled = euc.toString("latin1");
    expect(looksLikeWelcomepayMojibake(garbled)).toBe(true);
    expect(decodeWelcomepayPgTextFromEucKr(garbled)).toBe(plain);
  });

  it("keeps valid UTF-8 Korean", () => {
    const ok = "결제창을 열기 전 웰컴페이먼츠에서 요청이 거절되었습니다.";
    expect(normalizeWelcomepayPgUserMessage(ok)).toBe(ok);
  });

  it("drops unrecoverable mojibake", () => {
    expect(normalizeWelcomepayPgUserMessage("Ã¾Ã†Ã€ÃŒ")).toBe("");
  });
});
