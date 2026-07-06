import { Suspense } from "react";
import { SimplyurProductClient } from "./SimplyurProductClient";

type Props = { params: Promise<{ optionApiId: string }> };

export default async function SimplyurProductPage({ params }: Props) {
  const { optionApiId } = await params;
  return (
    <Suspense
      fallback={
        <main
          className="mx-auto max-w-lg px-[22px] py-8"
          style={{ backgroundColor: "#FFF4EF", minHeight: "60vh" }}
        >
          <div className="h-7 w-3/4 animate-pulse rounded-lg bg-[#EDE9E4]" />
        </main>
      }
    >
      <SimplyurProductClient optionApiId={optionApiId} />
    </Suspense>
  );
}
