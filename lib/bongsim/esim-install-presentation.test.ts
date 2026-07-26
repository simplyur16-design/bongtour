import { describe, expect, it } from "vitest";
import {
  buildEsimInstallFromTopup,
  formatEsimNotifyOrderLabel,
} from "@/lib/bongsim/esim-install-presentation";

// REGRESSION-FREEZE[bongsim-esim-multi-qty-qr]: notify label + multi install — manifest

describe("buildEsimInstallFromTopup", () => {
  const issued = {
    qr_code_img_url: "https://cdn.example/qr.png",
    download_link: "LPA:1$smdp$code",
    smdp: "smdp.example",
    activate_code: "ACT1",
  };

  it("delivered + QR — 설치 가능", () => {
    const r = buildEsimInstallFromTopup({ orderStatus: "delivered", ...issued });
    expect(r.ready).toBe(true);
    expect(r.qr_image_url).toBe(issued.qr_code_img_url);
    expect(r.revoked).toBeUndefined();
  });

  it("refunded — QR·링크 비노출(revoked)", () => {
    const r = buildEsimInstallFromTopup({ orderStatus: "refunded", ...issued });
    expect(r.ready).toBe(false);
    expect(r.revoked).toBe(true);
    expect(r.qr_image_url).toBeNull();
    expect(r.sm_dp_plus_address).toBeNull();
    expect(r.apple_quick_install_url).toBeNull();
  });

  it("qty>1 unit label on install", () => {
    const r = buildEsimInstallFromTopup({
      orderStatus: "delivered",
      ...issued,
      unit_index: 2,
      unit_total: 6,
      topup_row_id: "tid",
    });
    expect(r.unit_index).toBe(2);
    expect(r.unit_total).toBe(6);
  });
});

describe("formatEsimNotifyOrderLabel", () => {
  it("appends (k/N) for multi-qty", () => {
    expect(formatEsimNotifyOrderLabel("BS-1", 2, 6)).toBe("BS-1 (2/6)");
    expect(formatEsimNotifyOrderLabel("BS-1", 1, 1)).toBe("BS-1");
    expect(formatEsimNotifyOrderLabel("BS-1")).toBe("BS-1");
  });
});
