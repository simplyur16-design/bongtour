import { auth } from "@/auth";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { resolveEsimFirstPurchasePreview } from "@/lib/bongsim/promo/esim-first-purchase-preview";

export const dynamic = "force-dynamic";

/**
 * GET /api/bongsim/checkout/first-purchase-preview?subtotal_krw=20000&buyer_email=
 * 첫구매 자동 할인 프리뷰 — bongsim 15% / simplyur 14%+바닥.
 * simplyur: checkout_channel=simplyur_web|simplyur_app&option_api_id=
 * REGRESSION-FREEZE[simplyur-launch-discount-14pct]: simplyur preview channel + option — manifest
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const subtotalRaw = searchParams.get("subtotal_krw") ?? "";
  const subtotal_krw = Number.parseInt(subtotalRaw, 10);
  const buyer_email = searchParams.get("buyer_email")?.trim() ?? "";
  const checkout_channel = searchParams.get("checkout_channel")?.trim() ?? "";
  const option_api_id = searchParams.get("option_api_id")?.trim() ?? "";
  const quantityRaw = Number.parseInt(searchParams.get("quantity") ?? "1", 10);

  const session = await auth();
  const bongtour_user_id = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  const email = buyer_email || (session?.user?.email ?? "").trim();

  const preview = await resolveEsimFirstPurchasePreview({
    subtotal_krw,
    buyer_email: email,
    bongtour_user_id: bongtour_user_id || null,
    checkout_channel: checkout_channel || null,
    option_api_id: option_api_id || null,
    quantity: Number.isFinite(quantityRaw) ? quantityRaw : 1,
  });

  return jsonWithLeakGuard(preview, "bongsim.checkout.first-purchase-preview");
}
