import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import type { BongsimCheckoutConfirmResponseV1 } from "@/lib/bongsim/contracts/checkout-confirm.v1";
import { checkoutCreateOrderFromRequest } from "@/lib/bongsim/data/checkout-create-order";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { SIMPLYUR_CHECKOUT_TERMS_VERSION } from "@/lib/simplyur/checkout/channel";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";

export async function POST(req: Request) {
  try {
    if (!getPgPool()) {
      return jsonWithLeakGuard(
        { schema: "bongsim.checkout_confirm.error.v1", error: "db_unconfigured" },
        "simplyur.checkout.confirm",
        { status: 503 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonWithLeakGuard(
        { schema: "bongsim.checkout_confirm.error.v1", error: "invalid_json" },
        "simplyur.checkout.confirm",
        { status: 400 },
      );
    }

    const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const localeRaw = typeof raw.simplyur_locale === "string" ? raw.simplyur_locale : "en";
    const simplyurLocale: SimplyurLocale = isSimplyurLocale(localeRaw) ? localeRaw : "en";

    const merged = {
      ...raw,
      checkout_channel: "simplyur_web",
      buyer_locale: simplyurLocale === "en" ? "en" : "en",
      consents: {
        ...(raw.consents && typeof raw.consents === "object" ? (raw.consents as object) : {}),
        terms_version: SIMPLYUR_CHECKOUT_TERMS_VERSION,
        terms_accepted: true,
        simplyur_locale: simplyurLocale,
      },
    };

    const res = await checkoutCreateOrderFromRequest(merged);
    if (!res.ok) {
      const status =
        res.reason === "validation"
          ? 400
          : res.reason === "product_not_found"
            ? 404
            : res.reason === "idempotency_mismatch"
              ? 409
              : 503;
      return jsonWithLeakGuard(
        {
          schema: "bongsim.checkout_confirm.error.v1",
          error: res.reason,
          ...(res.details ? { details: res.details } : {}),
        },
        "simplyur.checkout.confirm",
        { status },
      );
    }

    const payload: BongsimCheckoutConfirmResponseV1 = {
      schema: "bongsim.checkout_confirm.response.v1",
      order: res.order,
    };
    return jsonWithLeakGuard(payload, "simplyur.checkout.confirm");
  } catch (e) {
    console.error("[api/simplyur/checkout/confirm]", e);
    return jsonWithLeakGuard(
      { schema: "bongsim.checkout_confirm.error.v1", error: "internal" },
      "simplyur.checkout.confirm",
      { status: 500 },
    );
  }
}
