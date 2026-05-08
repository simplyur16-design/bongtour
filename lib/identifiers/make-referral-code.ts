import { randomBytes } from "crypto";

export function makeReferralCode(): string {
  return `BONG-${randomBytes(3).toString("hex").toUpperCase()}`;
}
