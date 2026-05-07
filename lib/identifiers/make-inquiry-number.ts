import { randomBytes } from "crypto";

export function makeInquiryNumber(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rnd = randomBytes(4).toString("hex").toUpperCase();
  return `BI-${day}-${rnd}`;
}
