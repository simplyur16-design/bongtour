/**
 * OrderPaid outbox 백업 드레인 — 3분마다 (production + DATABASE_URL).
 * PG 콜백 직후 void drain이 서버리스에서 끊긴 경우 미처리 outbox 복구.
 */
export function startInstrumentationBongsimOrderPaidOutboxCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_BONGSIM_ORDER_PAID_OUTBOX_CRON === "1") {
    return;
  }
  void import("node-cron")
    .then((m) => {
      const cron = m.default;
      cron.schedule(
        "*/3 * * * *",
        () => {
          void tickBongsimOrderPaidOutboxCron();
        },
        { timezone: "Asia/Seoul" },
      );
      console.log("[bongsim-order-paid-outbox-cron] registered: */3 * * * * (Asia/Seoul)");
    })
    .catch((e) => {
      console.error("[bongsim-order-paid-outbox-cron] failed to load node-cron", e);
    });
}

async function tickBongsimOrderPaidOutboxCron(): Promise<void> {
  try {
    if (!(process.env.DATABASE_URL ?? "").trim()) {
      console.warn("[bongsim-order-paid-outbox-cron] skip: DATABASE_URL");
      return;
    }
    const { drainOrderPaidOutboxBestEffort } = await import(
      "@/lib/bongsim/fulfillment/process-order-paid-outbox"
    );
    await drainOrderPaidOutboxBestEffort(16);
  } catch (e) {
    console.error("[bongsim-order-paid-outbox-cron] error", e);
  }
}
