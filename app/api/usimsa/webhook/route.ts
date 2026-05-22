import { handleUsimsaWebhookPost } from "@/lib/bongsim/supplier/usimsa/handle-usimsa-webhook-post";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** USIMSA 콘솔에 등록된 레거시 URL — `/api/bongsim/webhooks/usimsa`와 동일 처리. */
export async function POST(req: Request) {
  return handleUsimsaWebhookPost(req, "usimsa:webhook", "usimsa.webhook.legacy");
}
