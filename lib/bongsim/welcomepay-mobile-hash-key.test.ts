import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import { generateMKey, resolveWelcomepayMobileHashKey } from "@/lib/bongsim/welcomepay";

describe("resolveWelcomepayMobileHashKey", () => {
  const prevHashKey = process.env.WELCOMEPAY_MOBILE_HASH_KEY;
  const prevSource = process.env.WELCOMEPAY_MOBILE_HASH_KEY_SOURCE;
  const prevSignKey = process.env.WELCOMEPAY_SIGN_KEY;

  afterEach(() => {
    if (prevHashKey === undefined) delete process.env.WELCOMEPAY_MOBILE_HASH_KEY;
    else process.env.WELCOMEPAY_MOBILE_HASH_KEY = prevHashKey;
    if (prevSource === undefined) delete process.env.WELCOMEPAY_MOBILE_HASH_KEY_SOURCE;
    else process.env.WELCOMEPAY_MOBILE_HASH_KEY_SOURCE = prevSource;
    if (prevSignKey === undefined) delete process.env.WELCOMEPAY_SIGN_KEY;
    else process.env.WELCOMEPAY_SIGN_KEY = prevSignKey;
  });

  it("WELCOMEPAY_MOBILE_HASH_KEY 명시 시 우선", () => {
    process.env.WELCOMEPAY_SIGN_KEY = "sign_raw";
    process.env.WELCOMEPAY_MOBILE_HASH_KEY = "explicit_hash";
    expect(resolveWelcomepayMobileHashKey()).toBe("explicit_hash");
  });

  it("기본 — SHA256(signKey) hex (mkey)", () => {
    process.env.WELCOMEPAY_SIGN_KEY = "my_sign_key";
    delete process.env.WELCOMEPAY_MOBILE_HASH_KEY;
    delete process.env.WELCOMEPAY_MOBILE_HASH_KEY_SOURCE;
    expect(resolveWelcomepayMobileHashKey()).toBe(generateMKey("my_sign_key"));
  });

  it("WELCOMEPAY_MOBILE_HASH_KEY_SOURCE=signkey — 웹 Signkey 원문", () => {
    process.env.WELCOMEPAY_SIGN_KEY = "my_sign_key";
    process.env.WELCOMEPAY_MOBILE_HASH_KEY_SOURCE = "signkey";
    expect(resolveWelcomepayMobileHashKey()).toBe("my_sign_key");
  });

  it("mkey는 signKey SHA256 hex", () => {
    const signKey = "test_sign_key";
    expect(generateMKey(signKey)).toBe(
      createHash("sha256").update(signKey, "utf8").digest("hex"),
    );
  });
});
