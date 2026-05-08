/**
 * PHASE H-4: 쿠폰 만료 임박 알림·만료 상태 반영 — 매일 POST 크론 엔드포인트 호출.
 * 스크래퍼 달력 배치(21:00)와 동일하게 production + DATABASE_URL 에서만 등록.
 */
function resolveInternalSiteBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.BONGTOUR_API_BASE?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}

export function startInstrumentationCouponCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_COUPON_CRON === "1") {
    return;
  }
  void import("node-cron")
    .then((m) => {
      const cron = m.default;
      cron.schedule(
        "0 9 * * *",
        () => {
          void tickCouponExpiryReminder();
        },
        { timezone: "Asia/Seoul" },
      );
      cron.schedule(
        "0 3 * * *",
        () => {
          void tickCouponExpire();
        },
        { timezone: "Asia/Seoul" },
      );
      console.log("[coupon-cron] registered: 0 9 * * * reminder, 0 3 * * * expire (Asia/Seoul)");
    })
    .catch((e) => {
      console.error("[coupon-cron] failed to load node-cron", e);
    });
}

async function postCronPath(path: string): Promise<void> {
  const secret = (process.env.BONGTOUR_CRON_SECRET ?? "").trim();
  if (!secret) {
    console.warn(`[coupon-cron] skip ${path}: BONGTOUR_CRON_SECRET`);
    return;
  }
  const base = resolveInternalSiteBase();
  if (!base) {
    console.warn(`[coupon-cron] skip ${path}: no NEXT_PUBLIC_SITE_URL / SITE_URL / NEXTAUTH_URL`);
    return;
  }
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "x-bongtour-cron-secret": secret },
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    console.log(`[coupon-cron] ${path}`, res.status, j);
  } catch (e) {
    console.error(`[coupon-cron] ${path} error`, e);
  }
}

async function tickCouponExpiryReminder() {
  await postCronPath("/api/cron/coupon-expiry-reminder");
}

async function tickCouponExpire() {
  await postCronPath("/api/cron/coupon-expire");
}
