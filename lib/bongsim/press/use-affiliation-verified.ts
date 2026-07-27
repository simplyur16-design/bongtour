"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * 로그인·명함 승인 여부 — 세션 JWT(로그인 시 DB) + affiliation-card GET 으로 보강.
 * 공개 상품 API는 소비자가만 반환; UI 할인가 표시용.
 */
export function useAffiliationVerified(): {
  affiliationVerified: boolean;
  affiliationReady: boolean;
} {
  const { data: session, status } = useSession();
  const sessionVerified = Boolean(
    (session?.user as { affiliationVerified?: boolean } | undefined)?.affiliationVerified,
  );
  const [apiVerified, setApiVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setApiVerified(null);
      return;
    }
    const ac = new AbortController();
    fetch("/api/bongsim/mypage/affiliation-card", { signal: ac.signal })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((j) => {
        setApiVerified(Boolean(j?.user?.affiliationVerified));
      })
      .catch(() => {
        if (!ac.signal.aborted) setApiVerified(null);
      });
    return () => ac.abort();
  }, [status]);

  if (status === "loading") {
    return { affiliationVerified: false, affiliationReady: false };
  }
  if (status !== "authenticated") {
    return { affiliationVerified: false, affiliationReady: true };
  }

  const affiliationVerified = apiVerified ?? sessionVerified;
  return {
    affiliationVerified,
    affiliationReady: apiVerified != null || sessionVerified,
  };
}
