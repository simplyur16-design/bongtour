import { Suspense } from "react";
import { SimplyurRecommendClient } from "./SimplyurRecommendClient";

export default function SimplyurRecommendPage() {
  return (
    <Suspense
      fallback={
        <main
          className="mx-auto max-w-lg px-[22px] py-8"
          style={{ backgroundColor: "#FFF4EF", minHeight: "60vh" }}
        >
          <div className="h-8 w-48 animate-pulse rounded bg-[#EFEDE9]" />
        </main>
      }
    >
      <SimplyurRecommendClient />
    </Suspense>
  );
}
