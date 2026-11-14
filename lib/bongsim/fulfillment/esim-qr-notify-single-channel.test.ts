import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  channel: "web" as string | null,
  alim: vi.fn(),
  lms: vi.fn(),
}));

vi.mock("@/lib/bongsim/db/pool", () => ({
  getBongsimFulfillOutboxPool: () => ({
    query: async (sql: string) => {
      if (sql.includes("checkout_channel")) {
        return { rows: [{ checkout_channel: h.channel, consents: null }] };
      }
      return { rows: [] };
    },
  }),
  getPgPool: () => ({
    query: async () => ({ rows: [] }),
  }),
}));

vi.mock("@/lib/bongsim/notifications/esim-qr-alimtalk", () => ({
  sendEsimQrDeliveredAlimTalk: (...args: unknown[]) => h.alim(...args),
}));

vi.mock("@/lib/notification-service", () => ({
  sendEsimQrDeliveredLmsFallback: (...args: unknown[]) => h.lms(...args),
}));

vi.mock("@/lib/simplyur/email/simplyur-esim-qr-mail", () => ({
  sendSimplyurEsimQrMail: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/bongsim/email/travel-esim-order-qr-mail", () => ({
  sendTravelEsimOrderQrMail: vi.fn(async () => ({ ok: true })),
}));

import { sendQueuedEsimQrCustomerNotify } from "@/lib/bongsim/fulfillment/esim-delivery";

const ORDER = "11111111-1111-1111-1111-111111111111";
const LPA = "LPA:1$consumer.rsp.world$TESTCODE";

function payload(downloadLink: string, email = "") {
  return {
    order_id: ORDER,
    order_number: "BS-TEST",
    delivery_email: email,
    delivery_phone: "01000000000",
    qr_code_url: "https://example.test/qr",
    download_link: downloadLink,
  };
}

describe("sendQueuedEsimQrCustomerNotify single channel", () => {
  beforeEach(() => {
    h.channel = "web";
    h.alim.mockReset();
    h.lms.mockReset();
    h.lms.mockResolvedValue({ ok: true });
  });

  it("does not send LMS when alimtalk succeeds, even with LPA", async () => {
    // REGRESSION-FREEZE[bongsim-esim-qr-os-install-lms-always]: alim ok → no LMS — manifest
    h.alim.mockResolvedValue({ ok: true });
    await sendQueuedEsimQrCustomerNotify(payload(LPA));
    expect(h.alim).toHaveBeenCalledTimes(1);
    expect(h.lms).not.toHaveBeenCalled();
  });

  it("sends LMS only after alimtalk asks for the fallback", async () => {
    h.alim.mockResolvedValue({
      ok: false,
      shouldSendLmsFallback: true,
      detail: "esim_qr_send_error",
    });
    await sendQueuedEsimQrCustomerNotify(payload(LPA));
    expect(h.alim).toHaveBeenCalledTimes(1);
    expect(h.lms).toHaveBeenCalledTimes(1);
    expect(h.alim.mock.invocationCallOrder[0]).toBeLessThan(h.lms.mock.invocationCallOrder[0]!);
  });

  it("keeps simplyur on LMS only", async () => {
    h.channel = "simplyur_app";
    h.alim.mockResolvedValue({ ok: true });
    await sendQueuedEsimQrCustomerNotify(payload(LPA, "buyer@example.test"));
    expect(h.lms).toHaveBeenCalledTimes(1);
    expect(h.alim).not.toHaveBeenCalled();
  });
});
