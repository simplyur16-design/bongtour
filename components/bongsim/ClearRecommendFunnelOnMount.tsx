"use client";

import { useEffect } from "react";
import {
  clearRecommendCheckoutDispatched,
  clearRecommendCheckoutQueue,
  clearRecommendFunnelSnapshot,
} from "@/lib/bongsim/recommend/funnel-storage";

/** 주문 완료 등 퍼널 종료 시 sessionStorage 정리 */
export function ClearRecommendFunnelOnMount() {
  useEffect(() => {
    clearRecommendFunnelSnapshot();
    clearRecommendCheckoutDispatched();
    clearRecommendCheckoutQueue();
  }, []);
  return null;
}
