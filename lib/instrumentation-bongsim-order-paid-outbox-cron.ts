/**
 * OrderPaid outbox 백업 드레인 — 2분마다 (production + DATABASE_URL).
 * PG 콜백 직후 drain이 끊긴 경우 미처리 outbox 복구.
 */
import { drainOrderPaidOutboxBestEffort } from "@/lib/bongsim/fulfillment/process-order-paid-outbox";

const CRON_EXPR = "*/2 * * * *";

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.RAILWAY_ENVIRONMENT === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

export function shouldRegisterBongsimOrderPaidOutboxCron(): boolean {
  if (process.env.DISABLE_INSTRUMENTATION_BONGSIM_ORDER_PAID_OUTBOX_CRON === "1") {
    return false;
  }
  if (!(process.env.DATABASE_URL ?? "").trim()) {
    return false;
  }
  return isProductionRuntime();
}

export function startInstrumentationBongsimOrderPaidOutboxCron(): void {
  const hasDb = Boolean((process.env.DATABASE_URL ?? "").trim());
  const prod = isProductionRuntime();
  console.log("[bongsim-order-paid-outbox-cron] register() called", {
    nodeEnv: process.env.NODE_ENV ?? "(unset)",
    railwayEnv: process.env.RAILWAY_ENVIRONMENT ?? "(unset)",
    hasDb,
    productionRuntime: prod,
    disabled: process.env.DISABLE_INSTRUMENTATION_BONGSIM_ORDER_PAID_OUTBOX_CRON === "1",
  });

  if (!shouldRegisterBongsimOrderPaidOutboxCron()) {
    console.warn("[bongsim-order-paid-outbox-cron] register skipped (need DATABASE_URL + production runtime)");
    return;
  }

  void import("node-cron")
    .then((m) => {
      const cron = m.default;
      cron.schedule(
        CRON_EXPR,
        () => {
          void tickBongsimOrderPaidOutboxCron("cron");
        },
        { timezone: "Asia/Seoul" },
      );
      console.log(`[bongsim-order-paid-outbox-cron] registered: ${CRON_EXPR} (Asia/Seoul)`);
      setTimeout(() => {
        void tickBongsimOrderPaidOutboxCron("boot");
      }, 45_000);
    })
    .catch((e) => {
      console.error("[bongsim-order-paid-outbox-cron] failed to load node-cron", e);
    });
}

async function tickBongsimOrderPaidOutboxCron(trigger: "cron" | "boot"): Promise<void> {
  const started = Date.now();
  console.log("[bongsim-order-paid-outbox-cron] tick start", { trigger, at: new Date().toISOString() });
  try {
    if (!(process.env.DATABASE_URL ?? "").trim()) {
      console.warn("[bongsim-order-paid-outbox-cron] tick skip: DATABASE_URL");
      return;
    }
    await drainOrderPaidOutboxBestEffort(16);
    console.log("[bongsim-order-paid-outbox-cron] tick done", {
      trigger,
      ms: Date.now() - started,
    });
  } catch (e) {
    console.error("[bongsim-order-paid-outbox-cron] tick error", { trigger, e });
  }
}
