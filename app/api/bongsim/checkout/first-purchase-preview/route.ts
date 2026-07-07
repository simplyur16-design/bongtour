import { auth } from "@/auth";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { resolveEsimFirstPurchasePreview } from "@/lib/bongsim/promo/esim-first-purchase-preview";

export const dynamic = "force-dynamic";

/**
 * GET /api/bongsim/checkout/first-purchase-preview?subtotal_krw=20000&buyer_email=
 * 첫구매 15% 자동 할인 프리뷰 — bongsim·simplyur 체크아웃 UI 공용.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const subtotalRaw = searchParams.get("subtotal_krw") ?? "";
  const subtotal_krw = Number.parseInt(subtotalRaw, 10);
  const buyer_email = searchParams.get("buyer_email")?.trim() ?? "";

  const session = await auth();
  const bongtour_user_id = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  const email = buyer_email || (session?.user?.email ?? "").trim();

  const preview = await resolveEsimFirstPurchasePreview({
    subtotal_krw,
    buyer_email: email,
    bongtour_user_id: bongtour_user_id || null,
  });

  return jsonWithLeakGuard(preview, "bongsim.checkout.first-purchase-preview");
}
