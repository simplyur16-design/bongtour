/**
 * Lightweight env presence checks (no secrets logged). Use alongside `getPgPool()` on routes.
 * Full contract: `lib/bongsim/integration/env-contract.ts`
 */
export function isDatabaseUrlConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
