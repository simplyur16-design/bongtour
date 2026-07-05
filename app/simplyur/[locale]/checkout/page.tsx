import { Suspense } from "react";
import { SimplyurCheckoutClient } from "./SimplyurCheckoutClient";

export default function SimplyurCheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-lg px-4 py-10">
          <div className="h-8 w-40 animate-pulse rounded bg-[color:var(--su-hanji-border)]" />
        </main>
      }
    >
      <SimplyurCheckoutClient />
    </Suspense>
  );
}
