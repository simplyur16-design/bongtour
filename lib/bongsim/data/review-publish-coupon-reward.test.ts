import { describe, expect, it } from "vitest";
import {
  REVIEW_PUBLISH_COUPON_REWARD_ENABLED,
  maybeIssueTravelReviewPublishedCoupon,
} from "@/lib/bongsim/data/review-publish-coupon-reward";

describe("maybeIssueTravelReviewPublishedCoupon", () => {
  it("review publish coupon reward is disabled by policy", () => {
    expect(REVIEW_PUBLISH_COUPON_REWARD_ENABLED).toBe(false);
  });

  it("returns immediately when disabled", async () => {
    await expect(maybeIssueTravelReviewPublishedCoupon("any-id")).resolves.toBeUndefined();
  });
});
