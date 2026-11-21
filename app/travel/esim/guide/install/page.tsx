import type { Metadata } from "next";
import Header from "@/app/components/Header";
import { EsimGuideSiteView } from "@/components/bongsim/esim/EsimGuideSiteView";
import { esimGuideLocale } from "@/lib/bongsim/esim-guide-site/load";
import { ESIM_INSTALL_GUIDE_PATH } from "@/lib/bongsim/esim-install-guide";
import EsimHelpChat from "@/components/bongsim/esim/EsimHelpChat";

const guide = esimGuideLocale().content.guide;

export const metadata: Metadata = {
  title: { absolute: `${guide.title} | Bong투어 eSIM` },
  description: guide.intro,
  alternates: { canonical: ESIM_INSTALL_GUIDE_PATH },
  robots: { index: true, follow: true },
};

export default function EsimInstallGuideInstallPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <EsimGuideSiteView page="guide" />
      </main>
      <EsimHelpChat />
    </div>
  );
}
