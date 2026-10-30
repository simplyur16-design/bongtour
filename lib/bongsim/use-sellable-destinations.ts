"use client";

import { useEffect, useState } from "react";
import { BONGSIM_SELLABLE_API_PATH } from "@/lib/bongsim/catalog/esim-sellable-visibility";

// REGRESSION-FREEZE[bongsim-esim-hide-unavailable]: 판매 플랜 0건 목적지 타일 숨김(클라 1회 조회, 실패 시 기존 목록) — manifest

let inflight: Promise<ReadonlySet<string> | null> | null = null;
let resolved: ReadonlySet<string> | null = null;

function loadOnce(): Promise<ReadonlySet<string> | null> {
  if (resolved) return Promise.resolve(resolved);
  if (!inflight) {
    inflight = fetch(BONGSIM_SELLABLE_API_PATH, { headers: { accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json()) as { destinations?: unknown };
        if (!Array.isArray(body.destinations)) return null;
        const set = new Set(
          body.destinations.filter((c): c is string => typeof c === "string").map((c) => c.toLowerCase()),
        );
        resolved = set;
        return set;
      })
      .catch(() => null)
      .finally(() => {
        if (!resolved) inflight = null;
      });
  }
  return inflight;
}

/** 판매 가능 목적지 코드 집합 — 로딩 중·실패면 null(필터 안 함) */
export function useSellableDestinations(): ReadonlySet<string> | null {
  const [set, setSet] = useState<ReadonlySet<string> | null>(resolved);
  useEffect(() => {
    let alive = true;
    void loadOnce().then((s) => {
      if (alive && s) setSet(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return set;
}
