import { Suspense } from "react";
import { headers } from "next/headers";
import { isMobileWelpayUserAgent } from "@/lib/bongsim/welcomepay-mobile-user-agent";
import WelcomepayPaymentClient from "./WelcomepayPaymentClient";

export default async function WelcomepayPaymentPage() {
  const ua = (await headers()).get("user-agent") ?? "";
  const initialMobileWelpay = isMobileWelpayUserAgent(ua);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bt-page text-sm text-slate-600">
          결제 처리 중...
        </div>
      }
    >
      <WelcomepayPaymentClient initialMobileWelpay={initialMobileWelpay} />
    </Suspense>
  );
}
