import { MOCK_PLANS } from "../mock-data";
import type { MockPlan } from "../types";

/**
 * Stub adapter — no network calls. Replace with real usimsa client when backend exists.
 */
export const USIMSA_ADAPTER_VERSION = "stub-v1";

export async function usimsaListPlansStub(): Promise<MockPlan[]> {
  return Promise.resolve([...MOCK_PLANS]);
}

export async function usimsaHealthStub(): Promise<{ ok: boolean; version: string }> {
  return Promise.resolve({ ok: true, version: USIMSA_ADAPTER_VERSION });
}
