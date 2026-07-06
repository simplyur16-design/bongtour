import { getSimplyurMessages, t } from "@/lib/simplyur/i18n";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { getSimplyurGuideMessages } from "@/lib/simplyur/guide-by-locale";
import { SIMPLYUR_GUIDE_DESIGN as D } from "@/lib/simplyur/guide-design";
import { SimplyurGuidePanel } from "@/components/simplyur/guide/SimplyurGuidePanel";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function SimplyurGuidePage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) notFound();
  const locale = raw as SimplyurLocale;
  const messages = await getSimplyurMessages(locale);
  const guide = getSimplyurGuideMessages(locale);

  return (
    <main
      className="mx-auto max-w-lg px-[22px] py-8 sm:max-w-2xl"
      style={{ backgroundColor: D.bg, paddingBottom: "calc(var(--su-tab-h) + 2.5rem)", minHeight: "70vh" }}
    >
      <SimplyurGuidePanel guide={guide} />
      <span className="sr-only">{t(messages, "guide.title")}</span>
    </main>
  );
}
