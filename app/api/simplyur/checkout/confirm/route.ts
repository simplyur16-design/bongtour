import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import type { BongsimCheckoutConfirmResponseV1 } from "@/lib/bongsim/contracts/checkout-confirm.v1";
import { checkoutCreateOrderFromRequest } from "@/lib/bongsim/data/checkout-create-order";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { resolveSimplyurApiUser } from "@/lib/simplyur/auth/resolve-simplyur-api-user";
import { isSimplyurCheckoutEnabled } from "@/lib/simplyur/checkout/enabled";
import {
  resolveSimplyurCheckoutChannel,
  simplyurBuyerLocaleForOrder,
  SIMPLYUR_CHECKOUT_TERMS_VERSION,
} from "@/lib/simplyur/checkout/channel";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";

/** REGRESSION-FREEZE[simplyur-checkout-channel-locale]: confirm channel + locale — manifest */
export async function POST(req: Request) {
  try {
    if (!isSimplyurCheckoutEnabled()) {
      return jsonWithLeakGuard(
        { schema: "bongsim.checkout_confirm.error.v1", error: "checkout_disabled" },
        "simplyur.checkout.confirm",
        { status: 503 },
      );
    }
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
    // Bind logged-in buyer (cookie or mobile Bearer) onto consents.bongtour_user_id.
    const apiUser = await resolveSimplyurApiUser(req);
    const bodyUserId = typeof raw.bongtour_user_id === "string" ? raw.bongtour_user_id.trim() : "";
    const bongtourUserId = apiUser?.userId || bodyUserId || undefined;

    const bodyChannel = typeof raw.checkout_channel === "string" ? raw.checkout_channel : null;
    const checkoutChannel = resolveSimplyurCheckoutChannel({ req, bodyChannel });

    const merged = {
      ...raw,
      ...(bongtourUserId ? { bongtour_user_id: bongtourUserId } : {}),
      checkout_channel: checkoutChannel,
      // ko|en column only — UI language is consents.simplyur_locale
      buyer_locale: simplyurBuyerLocaleForOrder(),
      consents: {
        ...(raw.consents && typeof raw.consents === "object" ? (raw.consents as object) : {}),
        terms_version: SIMPLYUR_CHECKOUT_TERMS_VERSION,
        terms_accepted: true,
        simplyur_locale: simplyurLocale,
      },
    };

    const res = await checkoutCreateOrderFromRequest(merged);
    if (!res.ok) {
      console.error("[api/simplyur/checkout/confirm] rejected", {
        reason: res.reason,
        details: res.details ?? null,
      });
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
