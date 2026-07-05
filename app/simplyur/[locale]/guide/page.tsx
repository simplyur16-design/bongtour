import { getSimplyurMessages, t } from "@/lib/simplyur/i18n";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { getSimplyurGuideMessages } from "@/lib/simplyur/guide-by-locale";
import { SimplyurGuideClient } from "@/components/simplyur/SimplyurGuideClient";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function SimplyurGuidePage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) notFound();
  const locale = raw as SimplyurLocale;
  const messages = await getSimplyurMessages(locale);
  const guide = getSimplyurGuideMessages(locale);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight su-text-ink">{t(messages, "guide.title")}</h1>
      <SimplyurGuideClient guide={guide} />
    </main>
  );
}
