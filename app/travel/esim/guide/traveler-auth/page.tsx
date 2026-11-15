import type { Metadata } from "next";
import Header from "@/app/components/Header";
import { EsimGuideSiteView } from "@/components/bongsim/esim/EsimGuideSiteView";
import { esimGuideLocale } from "@/lib/bongsim/esim-guide-site/load";
import { ESIM_TRAVELER_AUTH_PATH } from "@/lib/bongsim/esim-install-guide";

const auth = esimGuideLocale().content.auth;

export const metadata: Metadata = {
  title: { absolute: `${auth.title} | Bong투어 eSIM` },
  description: auth.intro,
  alternates: { canonical: ESIM_TRAVELER_AUTH_PATH },
  robots: { index: true, follow: true },
};

export default function EsimTravelerAuthPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <EsimGuideSiteView page="auth" />
      </main>
    </div>
  );
}
