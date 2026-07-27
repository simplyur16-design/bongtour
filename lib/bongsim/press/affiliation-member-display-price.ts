import { PRESS_MEMBER_DISCOUNT_RATE_PCT } from "@/lib/bongsim/press/press-member-discount-rate";

/** 소비자가 기준 명함 할인액(원, floor). confirm `computePressMemberDiscountKrw` 와 동일. */
export function affiliationMemberDiscountKrw(consumerKrw: number): number {
  const sub = Math.trunc(consumerKrw);
  if (!Number.isFinite(sub) || sub <= 0) return 0;
  return Math.floor((sub * PRESS_MEMBER_DISCOUNT_RATE_PCT) / 100);
}

/** 명함 승인 회원 표시·미리보기 할인가(원). */
export function affiliationMemberNetKrw(consumerKrw: number): number {
  const sub = Math.trunc(consumerKrw);
  if (!Number.isFinite(sub) || sub <= 0) return 0;
  return Math.max(0, sub - affiliationMemberDiscountKrw(sub));
}

/**
 * 스토어프론트 표시 단가 — 명함 승인이면 소비자가 25% 할인, 아니면 소비자가.
 * PG 청구는 서버 confirm 이 동일 규칙으로 재계산한다.
 */
export function storefrontDisplayUnitKrw(
  consumerKrw: number,
  affiliationVerified: boolean,
): number {
  const unit = Math.trunc(consumerKrw);
  if (!Number.isFinite(unit) || unit < 0) return 0;
  return affiliationVerified ? affiliationMemberNetKrw(unit) : unit;
}
