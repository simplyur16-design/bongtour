import { Suspense } from "react";
import { SimplyurCheckoutCompleteClient } from "./SimplyurCheckoutCompleteClient";

export default function SimplyurCheckoutCompletePage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-lg px-4 py-12" />}>
      <SimplyurCheckoutCompleteClient />
    </Suspense>
  );
}
