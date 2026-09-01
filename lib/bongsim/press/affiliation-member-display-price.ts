import { bongtourAffiliationFloorNetFromSupplyKrw } from "@/lib/bongsim/data/pricing-bongtour-list";
import { PRESS_MEMBER_DISCOUNT_RATE_PCT } from "@/lib/bongsim/press/press-member-discount-rate";

// REGRESSION-FREEZE[bongsim-display-recommended-floor]: 명함 25% · 공급가×1.25 바닥 — manifest

/** 명함 25% 할인액. 공급가가 있으면 잔액이 공급가×1.25 아래로 내려가지 않게 할인액을 줄임. */
export function affiliationMemberDiscountKrw(
  listKrw: number,
  supplyKrw?: number | null,
): number {
  const list = Math.trunc(listKrw);
  if (!Number.isFinite(list) || list <= 0) return 0;
  return Math.max(0, list - affiliationMemberNetKrw(list, supplyKrw));
}

/** 명함 승인 회원 표시·미리보기 할인가(원). */
export function affiliationMemberNetKrw(
  listKrw: number,
  supplyKrw?: number | null,
): number {
  const list = Math.trunc(listKrw);
  if (!Number.isFinite(list) || list <= 0) return 0;
  const rawNet = Math.max(0, list - Math.floor((list * PRESS_MEMBER_DISCOUNT_RATE_PCT) / 100));
  if (supplyKrw == null || !Number.isFinite(supplyKrw) || supplyKrw < 0) return rawNet;
  const floorNet = bongtourAffiliationFloorNetFromSupplyKrw(supplyKrw);
  if (floorNet == null) return rawNet;
  return Math.min(list, Math.max(rawNet, floorNet));
}

/**
 * 스토어프론트 표시 단가 — 명함 승인이면 표시가 25%(공급가×1.25 바닥), 아니면 표시가.
 * PG 청구는 서버 confirm 이 동일 규칙으로 재계산한다.
 */
export function storefrontDisplayUnitKrw(
  listKrw: number,
  affiliationVerified: boolean,
  supplyKrw?: number | null,
): number {
  const unit = Math.trunc(listKrw);
  if (!Number.isFinite(unit) || unit < 0) return 0;
  return affiliationVerified ? affiliationMemberNetKrw(unit, supplyKrw) : unit;
}
