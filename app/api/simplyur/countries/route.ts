import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { getSimplyurMessages, t } from "@/lib/simplyur/i18n";

export const revalidate = 120;
export const dynamic = "force-dynamic";

/**
 * GET /api/simplyur/countries?locale=en
 * Korea only — localized labels, no ISO2 codes in the response.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const localeParam = searchParams.get("locale") ?? "en";
  const locale: SimplyurLocale = isSimplyurLocale(localeParam) ? localeParam : "en";
  const messages = await getSimplyurMessages(locale);

  return jsonWithLeakGuard(
    {
      locale,
      countries: [
        {
          name: t(messages, "countries.kr.name"),
          subtitle: t(messages, "countries.kr.subtitle"),
        },
      ],
    },
    "simplyur.countries",
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
