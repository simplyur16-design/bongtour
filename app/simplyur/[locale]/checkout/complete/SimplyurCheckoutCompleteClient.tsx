"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { simplyurPath } from "@/lib/simplyur/constants";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import {
  clearSimplyurPartnerReturn,
  readSimplyurPartnerReturnTo,
} from "@/components/simplyur/SimplyurPartnerReturnCapture";

function navigatePartnerReturn(href: string) {
  clearSimplyurPartnerReturn();
  try {
    sessionStorage.removeItem("simplyur_embed");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined" && window.top && window.top !== window) {
    window.top.location.href = href;
    return;
  }
  window.location.href = href;
}

export function SimplyurCheckoutCompleteClient() {
  const searchParams = useSearchParams();
  const orderNumber = (searchParams?.get("orderNumber") ?? "").trim();
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();
  const [partnerReturn, setPartnerReturn] = useState<string | null>(null);

  useEffect(() => {
    const href = readSimplyurPartnerReturnTo();
    setPartnerReturn(href);
    // In-app iframe: auto-return to simplyurtrip after short beat
    if (href && typeof window !== "undefined" && window.top && window.top !== window) {
      const t = window.setTimeout(() => navigatePartnerReturn(href), 1200);
      return () => window.clearTimeout(t);
    }
  }, []);

  return (
    <main className="mx-auto max-w-lg px-4 py-12 text-center sm:px-6">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--su-celadon-light)] text-3xl">
        ✓
      </div>
      <h1 className="mt-6 text-2xl font-bold su-text-ink">{tr("checkout.completeTitle")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--su-ink-muted)]">{tr("checkout.completeBody")}</p>
      {orderNumber ? (
        <p className="mt-4 text-sm su-text-ink">
          {tr("checkout.orderNumber")}: <span className="font-semibold">{orderNumber}</span>
        </p>
      ) : null}
      <div className="mt-8 flex flex-col items-center gap-3">
        {partnerReturn ? (
          <button
            type="button"
            className="inline-flex rounded-full bg-[color:var(--su-celadon)] px-8 py-3 text-base font-semibold text-white"
            onClick={() => navigatePartnerReturn(partnerReturn)}
          >
            {tr("checkout.continueTrip")}
          </button>
        ) : null}
        <Link
          href={simplyurPath(locale, "/recommend")}
          className="inline-flex rounded-full border-2 border-[color:var(--su-celadon)] px-8 py-3 text-base font-semibold text-[color:var(--su-celadon-dark)]"
        >
          {tr("checkout.viewPlans")}
        </Link>
      </div>
    </main>
  );
}
