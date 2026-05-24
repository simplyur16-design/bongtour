import {
  BONGSIM_RECOMMEND_CHECKOUT_QUEUE_KEY,
  type BongsimRecommendCheckoutLine,
} from "@/lib/bongsim/constants";

/** 추천 퍼널 UI 복원 (뒤로가기·새로고침) */
export const BONGSIM_RECOMMEND_FUNNEL_SNAPSHOT_KEY = "bongsim:recommend_funnel_snapshot:v1";

/** 동일 선택으로 checkout 자동 이동은 1회만 (브라우저 뒤로가기 루프 방지) */
export const BONGSIM_RECOMMEND_CHECKOUT_DISPATCHED_KEY = "bongsim:recommend_checkout_dispatched:v1";

export type RecommendFunnelSnapshot = {
  step: 1 | 2;
  selectedCodes: string[];
  completed: Record<
    string,
    {
      optionApiId: string;
      quantity: number;
      summaryLine: string;
    }
  >;
};

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined";
}

export function loadRecommendFunnelSnapshot(): RecommendFunnelSnapshot | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = sessionStorage.getItem(BONGSIM_RECOMMEND_FUNNEL_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecommendFunnelSnapshot;
    if (parsed.step !== 1 && parsed.step !== 2) return null;
    if (!Array.isArray(parsed.selectedCodes)) return null;
    if (!parsed.completed || typeof parsed.completed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRecommendFunnelSnapshot(snapshot: RecommendFunnelSnapshot): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.setItem(BONGSIM_RECOMMEND_FUNNEL_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota */
  }
}

export function clearRecommendFunnelSnapshot(): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(BONGSIM_RECOMMEND_FUNNEL_SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

export function checkoutQueueFingerprint(queue: BongsimRecommendCheckoutLine[]): string {
  return JSON.stringify(
    [...queue]
      .map((l) => ({ optionApiId: l.optionApiId, quantity: l.quantity }))
      .sort((a, b) => a.optionApiId.localeCompare(b.optionApiId)),
  );
}

export function wasRecommendCheckoutDispatched(queue: BongsimRecommendCheckoutLine[]): boolean {
  if (!canUseSessionStorage()) return false;
  try {
    const fp = checkoutQueueFingerprint(queue);
    return sessionStorage.getItem(BONGSIM_RECOMMEND_CHECKOUT_DISPATCHED_KEY) === fp;
  } catch {
    return false;
  }
}

export function markRecommendCheckoutDispatched(queue: BongsimRecommendCheckoutLine[]): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.setItem(BONGSIM_RECOMMEND_CHECKOUT_DISPATCHED_KEY, checkoutQueueFingerprint(queue));
  } catch {
    /* ignore */
  }
}

export function clearRecommendCheckoutDispatched(): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(BONGSIM_RECOMMEND_CHECKOUT_DISPATCHED_KEY);
  } catch {
    /* ignore */
  }
}

export function writeRecommendCheckoutQueue(queue: BongsimRecommendCheckoutLine[]): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.setItem(BONGSIM_RECOMMEND_CHECKOUT_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* ignore */
  }
}

export function clearRecommendCheckoutQueue(): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(BONGSIM_RECOMMEND_CHECKOUT_QUEUE_KEY);
  } catch {
    /* ignore */
  }
}
