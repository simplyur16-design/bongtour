import { describe, expect, it } from "vitest";
import { buildEsimInstallFromTopup } from "@/lib/bongsim/esim-install-presentation";

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
});
