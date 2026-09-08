"use client";

import { useEffect, useState } from "react";

/**
 * Client LPA QR (eSIM install payload). Falls back to install buttons if encode fails.
 * REGRESSION-FREEZE[simplyur-my-esim-paid-qr-install]: web LPA QR — manifest
 */
export function SimplyurLpaQrImg({ lpa }: { lpa: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const QR = (await import("qrcode")).default;
        const url = await QR.toDataURL(lpa, {
          width: 336,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#12233F", light: "#FFFFFF" },
        });
        if (!cancelled) setSrc(url);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lpa]);

  if (!src) {
    return (
      <div className="flex h-[168px] w-[168px] items-center justify-center rounded-[14px] bg-[#f8f8f8] text-center text-[11px] leading-relaxed text-slate-500">
        Install QR
      </div>
    );
  }

  return (
    // data: URL — next/image is not used
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="eSIM QR" width={168} height={168} className="rounded-[14px] bg-white p-2" />
  );
}
