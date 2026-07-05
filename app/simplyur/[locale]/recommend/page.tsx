import { Suspense } from "react";
import { SimplyurRecommendClient } from "./SimplyurRecommendClient";

export default function SimplyurRecommendPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-4 py-10">
          <div className="h-8 w-48 animate-pulse rounded bg-[color:var(--su-hanji-border)]" />
        </main>
      }
    >
      <SimplyurRecommendClient />
    </Suspense>
  );
}
