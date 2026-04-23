import type { BongsimPaymentReturnUrlsV1 } from "@/lib/bongsim/contracts/payment-integration.v1";

function appendOrSetSearchParam(url: string, key: string, value: string): string {
  try {
    const base = url.startsWith("/") ? "http://bongsim.local" : undefined;
    const u = base ? new URL(url, base) : new URL(url);
    u.searchParams.set(key, value);
    if (url.startsWith("/")) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
    return u.toString();
  } catch {
    const join = url.includes("?") ? "&" : "?";
    return `${url}${join}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
}

/** When `BONGSIM_ORDER_READ_KEY` is set, append `read_key` to return URLs so client flows can poll/read orders. */
export function mergeOrderReadKeyIntoReturnUrls(
  urls: BongsimPaymentReturnUrlsV1,
  readKey: string | undefined,
): BongsimPaymentReturnUrlsV1 {
  const k = readKey?.trim();
  if (!k) return urls;
  return {
    success_url: appendOrSetSearchParam(urls.success_url, "read_key", k),
    fail_url: appendOrSetSearchParam(urls.fail_url, "read_key", k),
    cancel_url: appendOrSetSearchParam(urls.cancel_url, "read_key", k),
  };
}
