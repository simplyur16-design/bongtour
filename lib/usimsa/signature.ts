import { createHmac } from "node:crypto";

export function createUsimsaTimestamp(): string {
  return String(Date.now());
}

export function createUsimsaSignature(params: {
  method: string;
  pathAndQuery: string;
  timestamp: string;
  accessKey: string;
  secretKey: string;
}): string {
  const method = params.method.toUpperCase();
  const stringToSign = `${method} ${params.pathAndQuery}\n${params.timestamp}\n${params.accessKey}`;
  const hmac = createHmac("sha256", Buffer.from(params.secretKey, "base64"));
  hmac.update(stringToSign, "utf8");
  return hmac.digest("base64");
}
