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

export async function usimsaRequest<T>(params: {
  method: UsimsaHttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}): Promise<T> {
  const cfg = getUsimsaConfig();
  const path = params.path.startsWith("/") ? params.path : `/${params.path}`;
  const queryString = buildQueryString(params.query);
  const pathAndQuery = `${path}${queryString}`;
  /** 실제 요청 URL은 …/api + /v2/… → pathname /api/v2/… — USIMSA 서명 StringToSign도 이 path 기준. */
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
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "x-gat-timestamp": timestamp,
    "x-gat-access-key": cfg.accessKey,
    "x-gat-signature": signature,
  };

  const init: RequestInit = {
    method: params.method,
    headers,
    cache: "no-store",
  };

  if (params.method !== "GET" && params.body !== undefined) {
    init.body = JSON.stringify(params.body);
  }

  const res = await fetch(url, init);
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
