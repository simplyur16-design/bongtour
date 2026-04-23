import type { FunnelState } from "./types";

/** STEP 1 전용(국가 선택만). */
export type RecommendStep = 1;

export function getFirstIncompleteStep(f: FunnelState): RecommendStep {
  void f;
  return 1;
}

export function clearSelectionsAfterStep(step: RecommendStep): Partial<FunnelState> {
  if (step <= 1) {
    return {
      tripStart: null,
      tripEnd: null,
      tripDurationDays: null,
      tripDurationNights: null,
      network: null,
      planId: null,
      coverageProductId: null,
    };
  }
  return {
    tripStart: null,
    tripEnd: null,
    tripDurationDays: null,
    tripDurationNights: null,
    network: null,
    planId: null,
    coverageProductId: null,
  };
}
