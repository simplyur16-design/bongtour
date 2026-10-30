import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Poppins } from "next/font/google";
import { auth } from "@/auth";
import { SimplyurFooter } from "@/components/simplyur/SimplyurFooter";
import { SimplyurHeader } from "@/components/simplyur/SimplyurHeader";
import { SimplyurTabBar } from "@/components/simplyur/SimplyurTabBar";
import { SimplyurEmbedChrome } from "@/components/simplyur/SimplyurEmbedMode";
import { SimplyurIntlProvider } from "@/components/simplyur/SimplyurIntlProvider";
import { SimplyurPartnerReturnBanner } from "@/components/simplyur/SimplyurPartnerReturnBanner";
import { SimplyurPartnerReturnCapture } from "@/components/simplyur/SimplyurPartnerReturnCapture";
import {
  isSimplyurLocale,
  SIMPLYUR_LOCALES,
  type SimplyurLocale,
} from "@/lib/simplyur/constants";
import { getSimplyurMessages, t } from "@/lib/simplyur/i18n";
import { SIMPLYUR_BRAND } from "@/lib/simplyur/brand";
import { getSeasonalDefaultOgImagePath } from "@/lib/og-image-seasonal";
import "../simplyur-theme.css";

const SIMPLYUR_TITLE_BRAND = "Simplyur eSIM";

const simplyurFont = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-simplyur",
  display: "swap",
});

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return SIMPLYUR_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) return {};
  const messages = await getSimplyurMessages(raw);
  const title = t(messages, "meta.title");
  const description = t(messages, "meta.description");
  // 루트 template(`%s | Bong투어`)을 끊고 simplyur 브랜드 기준으로 제목을 맞춘다.
  // openGraph/twitter는 자식에서 정의하면 루트 값을 통째로 덮으므로 기존 이미지·카드 형식은 그대로 유지한다.
  const ogImagePath = getSeasonalDefaultOgImagePath();
  return {
    title: {
      absolute: title,
      template: `%s | ${SIMPLYUR_TITLE_BRAND}`,
    },
    description,
    openGraph: {
      type: "website",
      siteName: SIMPLYUR_TITLE_BRAND,
      title,
      description,
      images: [{ url: ogImagePath, alt: SIMPLYUR_TITLE_BRAND }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImagePath],
    },
    icons: {
      icon: SIMPLYUR_BRAND.iconImage,
      apple: SIMPLYUR_BRAND.iconImage,
    },
  };
}

export default async function SimplyurLocaleLayout({ children, params }: LayoutProps) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) notFound();
  const locale = raw as SimplyurLocale;
  const messages = await getSimplyurMessages(locale);
  const session = await auth();

  return (
    <SimplyurIntlProvider locale={locale} messages={messages}>
      <div className={`simplyur-theme su-app-shell min-h-screen ${simplyurFont.variable}`}>
        <Suspense fallback={null}>
          <SimplyurPartnerReturnCapture />
        </Suspense>
        <Suspense fallback={<>{children}</>}>
          <SimplyurEmbedChrome
            header={
              <>
                <SimplyurHeader locale={locale} user={session?.user ?? null} />
                <SimplyurPartnerReturnBanner />
              </>
            }
            footer={
              <>
                <SimplyurFooter />
                <SimplyurTabBar locale={locale} />
              </>
            }
          >
            {children}
          </SimplyurEmbedChrome>
        </Suspense>
      </div>
    </SimplyurIntlProvider>
  );
}
