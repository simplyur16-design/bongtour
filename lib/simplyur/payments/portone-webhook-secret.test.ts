import { describe, expect, it } from "vitest";
import {
  resolvePortoneWebhookSecret,
  resolvePortoneWebhookSecretFormat,
} from "@/lib/simplyur/payments/portone-env";

describe("simplyur portone webhook secret env", () => {
  it("reads PORTONE_WEBHOOK_SECRET when set", () => {
    const prev = process.env.PORTONE_WEBHOOK_SECRET;
    process.env.PORTONE_WEBHOOK_SECRET = "  test-whsec  ";
    try {
      expect(resolvePortoneWebhookSecret()).toBe("test-whsec");
    } finally {
      if (prev === undefined) delete process.env.PORTONE_WEBHOOK_SECRET;
      else process.env.PORTONE_WEBHOOK_SECRET = prev;
    }
  });

  it("webhook secret format defaults to base64", () => {
    const prev = process.env.PORTONE_WEBHOOK_SECRET_FORMAT;
    delete process.env.PORTONE_WEBHOOK_SECRET_FORMAT;
    try {
      expect(resolvePortoneWebhookSecretFormat()).toBe("base64");
    } finally {
      if (prev === undefined) delete process.env.PORTONE_WEBHOOK_SECRET_FORMAT;
      else process.env.PORTONE_WEBHOOK_SECRET_FORMAT = prev;
    }
  });

  it("webhook secret format raw", () => {
    const prev = process.env.PORTONE_WEBHOOK_SECRET_FORMAT;
    process.env.PORTONE_WEBHOOK_SECRET_FORMAT = "raw";
    try {
      expect(resolvePortoneWebhookSecretFormat()).toBe("raw");
    } finally {
      if (prev === undefined) delete process.env.PORTONE_WEBHOOK_SECRET_FORMAT;
      else process.env.PORTONE_WEBHOOK_SECRET_FORMAT = prev;
    }
  });
});
