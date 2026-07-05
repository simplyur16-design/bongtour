import { Suspense } from "react";
import { SimplyurProductClient } from "./SimplyurProductClient";

type Props = { params: Promise<{ optionApiId: string }> };

export default async function SimplyurProductPage({ params }: Props) {
  const { optionApiId } = await params;
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl px-4 py-10">
          <div className="h-8 w-48 animate-pulse rounded bg-[color:var(--su-hanji-border)]" />
        </main>
      }
    >
      <SimplyurProductClient optionApiId={optionApiId} />
    </Suspense>
  );
}
