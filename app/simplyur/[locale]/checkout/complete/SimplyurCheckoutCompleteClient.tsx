"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { simplyurPath } from "@/lib/simplyur/constants";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

export function SimplyurCheckoutCompleteClient() {
  const searchParams = useSearchParams();
  const orderNumber = (searchParams.get("orderNumber") ?? "").trim();
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();

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
      <Link
        href={simplyurPath(locale, "/recommend")}
        className="mt-8 inline-flex rounded-full border-2 border-[color:var(--su-celadon)] px-8 py-3 text-base font-semibold text-[color:var(--su-celadon-dark)]"
      >
        {tr("checkout.viewPlans")}
      </Link>
    </main>
  );
}
