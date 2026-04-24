"use client";

import { useEffect, useState } from "react";

/** `true` when viewport width is strictly less than `breakpointPx` (e.g. 768 → max-width 767px). */
export function useMediaQueryBelow(breakpointPx: number): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [breakpointPx]);

  return matches;
}
