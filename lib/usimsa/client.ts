import { getUsimsaConfig } from "@/lib/usimsa/config";
import { createUsimsaSignature, createUsimsaTimestamp } from "@/lib/usimsa/signature";

export type UsimsaHttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export class UsimsaRequestError extends Error {
  readonly method: string;
  readonly pathAndQuery: string;
  readonly status: number;
  readonly responseBody: unknown;

  constructor(
    message: string,
    init: { method: string; pathAndQuery: string; status: number; responseBody: unknown },
  ) {
    super(message);
    this.name = "UsimsaRequestError";
    this.method = init.method;
    this.pathAndQuery = init.pathAndQuery;
    this.status = init.status;
    this.responseBody = init.responseBody;
  }
}

function readUsimsaFetchTimeoutMs(): number {
  const raw = process.env.USIMSA_FETCH_TIMEOUT_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1000 && n <= 120_000) return n;
  }
  return 15_000;
}

function buildQueryString(query?: Record<string, string | number | boolean | undefined | null>): string {
  if (!query) {
    return "";
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

function isAbortError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const name = "name" in e ? String((e as { name?: string }).name) : "";
  return name === "AbortError" || e instanceof DOMException;
}

export async function usimsaRequest<T>(params: {
  method: UsimsaHttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}): Promise<T> {
  const cfg = getUsimsaConfig();
  /** 호출부는 `/v2/...` 형태를 넘긴다. URL은 `baseUrl`(이미 `/api`까지) + path → …/api/v2/… */
  const path = params.path.startsWith("/") ? params.path : `/${params.path}`;
  const queryString = buildQueryString(params.query);
  const pathAndQuery = `${path}${queryString}`;
  /** StringToSign용 path는 반드시 `/api` 접두 포함 (예: `/api/v2/order`). 문서 6.1·6.2와 동일. */
  const pathForSign = path.startsWith("/api") ? path : `/api${path}`;
  const pathAndQueryForSign = `${pathForSign}${queryString}`;
  const timestamp = createUsimsaTimestamp();
  const signature = createUsimsaSignature({
    method: params.method,
    pathAndQuery: pathAndQueryForSign,
    timestamp,
    accessKey: cfg.accessKey,
    secretKey: cfg.secretKey,
  });

  const url = `${cfg.baseUrl}${pathAndQuery}`;
  const headers: Record<string, string> = {
    "x-gat-timestamp": timestamp,
    "x-gat-access-key": cfg.accessKey,
    "x-gat-signature": signature,
  };
  if (params.method === "POST" || params.method === "PUT") {
    headers["Content-Type"] = "application/json";
  }

  const timeoutMs = readUsimsaFetchTimeoutMs();
  const init: RequestInit = {
    method: params.method,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  };

  if (params.method !== "GET" && params.body !== undefined) {
    init.body = JSON.stringify(params.body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if (isAbortError(e)) {
      const sec = timeoutMs / 1000;
      throw new UsimsaRequestError(`USIMSA API timeout after ${sec}s`, {
        method: params.method,
        pathAndQuery,
        status: 408,
        responseBody: null,
      });
    }
    throw e;
  }

  const text = await res.text();

  let parsed: unknown = text;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  } else {
    parsed = null;
  }

  if (!res.ok) {
    throw new UsimsaRequestError(
      `Usimsa HTTP ${res.status} for ${params.method} ${pathAndQuery}`,
      {
        method: params.method,
        pathAndQuery,
        status: res.status,
        responseBody: parsed,
      },
    );
  }

  return parsed as T;
}
