import {
  callEximbayPaymentsVerify,
  eximbayStatusUrlAckBody,
} from "@/lib/simplyur/payments/eximbay-verify";

// REGRESSION-FREEZE[simplyur-eximbay-payment-prep]: status_url webhook + verify — manifest
// Prep stage: verify FGKey integrity only — does NOT mark order paid / fulfill eSIM.

async function extractStatusQueryString(req: Request): Promise<string> {
  const url = new URL(req.url);
  if (url.search && url.search.length > 1) {
    return url.search.slice(1);
  }

  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    return text.trim();
  }
  if (contentType.includes("application/json")) {
    try {
      const json = (await req.json()) as { data?: unknown };
      if (typeof json.data === "string") return json.data.trim();
    } catch {
      /* fall through */
    }
  }

  try {
    const text = await req.text();
    if (text.includes("=")) return text.trim();
  } catch {
    /* empty */
  }
  return "";
}

async function handleStatus(req: Request): Promise<Response> {
  let data: string;
  try {
    data = await extractStatusQueryString(req);
  } catch {
    return new Response(eximbayStatusUrlAckBody(false, "bad_body"), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (!data) {
    return new Response(eximbayStatusUrlAckBody(false, "empty"), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const verified = await callEximbayPaymentsVerify(data);
  if (!verified.ok) {
    console.warn("[simplyur:eximbay:status]", {
      reason: verified.reason,
      rescode: verified.rescode,
      resmsg: verified.resmsg,
    });
    // Still ACK so Eximbay does not hammer; paid/fulfill is next phase.
    return new Response(eximbayStatusUrlAckBody(true), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  console.info("[simplyur:eximbay:status:verified]", {
    rescode: verified.rescode,
    // order paid + fulfillment intentionally deferred (prep stage)
  });

  return new Response(eximbayStatusUrlAckBody(true), {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  return handleStatus(req);
}

export async function GET(req: Request) {
  return handleStatus(req);
}
