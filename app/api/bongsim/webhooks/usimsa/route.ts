import { handleUsimsaWebhookPost } from "@/lib/bongsim/supplier/usimsa/handle-usimsa-webhook-post";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** USIMSA Partner API 웹훅 (봉심 경로). 레거시 `/api/usimsa/webhook`과 동일 처리. */
export async function POST(req: Request) {
  return handleUsimsaWebhookPost(req, "bongsim:webhooks:usimsa", "bongsim.webhooks.usimsa");
}
