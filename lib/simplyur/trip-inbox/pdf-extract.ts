/**
 * Best-effort PDF text extract for confirmation PDFs (no extra dependency).
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: extractPdfText — manifest
 */
import { inflateRawSync, inflateSync } from "node:zlib";

function decodePdfLiteral(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([0-7]{1,3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, "$1");
}

function stringsFromContent(content: string): string {
  const chunks: string[] = [];
  for (const m of content.matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g)) {
    chunks.push(decodePdfLiteral(m[1]));
  }
  for (const m of content.matchAll(/\[(.*?)\]\s*TJ/gs)) {
    for (const s of m[1].matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g)) {
      chunks.push(decodePdfLiteral(s[1]));
    }
  }
  return chunks.join(" ");
}

function inflateStream(bytes: Buffer): string | null {
  try {
    return inflateSync(bytes).toString("latin1");
  } catch {
    try {
      return inflateRawSync(bytes).toString("latin1");
    } catch {
      return null;
    }
  }
}

export function extractPdfText(bytes: Uint8Array): string {
  const latin1 = Buffer.from(bytes).toString("latin1");
  if (!latin1.startsWith("%PDF")) {
    throw new Error("not_pdf");
  }
  if (/\/Encrypt\b/.test(latin1)) {
    throw new Error("pdf_encrypted");
  }

  const parts: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin1))) {
    const headerStart = latin1.lastIndexOf("<<", m.index);
    const header = headerStart >= 0 ? latin1.slice(headerStart, m.index) : "";
    const payload = Buffer.from(m[1], "latin1");
    let content = payload.toString("latin1");
    if (/\/FlateDecode/.test(header)) {
      const inflated = inflateStream(payload);
      if (!inflated) continue;
      content = inflated;
    }
    const text = stringsFromContent(content);
    if (text.trim()) parts.push(text);
  }

  const joined = parts.join("\n").replace(/[ \t]{2,}/g, " ").trim();
  return joined;
}
