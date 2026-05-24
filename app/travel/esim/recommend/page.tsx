import { Suspense } from "react";
import Header from "@/app/components/Header";
import RecommendPageClient from "./RecommendPageClient";

export default function RecommendPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bt-page">
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-slate-600">
            불러오는 중…
          </main>
        </div>
      }
    >
      <RecommendPageClient />
    </Suspense>
  );
}
