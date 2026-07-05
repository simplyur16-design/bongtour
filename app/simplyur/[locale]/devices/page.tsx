import { getSimplyurMessages, t } from "@/lib/simplyur/i18n";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function SimplyurDevicesPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) notFound();
  const locale = raw as SimplyurLocale;
  const messages = await getSimplyurMessages(locale);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight su-text-ink">{t(messages, "devices.title")}</h1>
      <p className="mt-4 text-base leading-relaxed text-[color:var(--su-ink-muted)]">{t(messages, "devices.intro")}</p>
      <ul className="mt-8 space-y-4">
        <li className="su-card p-5 shadow-sm">
          <h2 className="font-semibold su-text-ink">iPhone</h2>
          <p className="mt-2 text-sm text-[color:var(--su-ink-muted)]">{t(messages, "devices.iphone")}</p>
        </li>
        <li className="su-card p-5 shadow-sm">
          <h2 className="font-semibold su-text-ink">Android</h2>
          <p className="mt-2 text-sm text-[color:var(--su-ink-muted)]">{t(messages, "devices.android")}</p>
        </li>
      </ul>
    </main>
  );
}
