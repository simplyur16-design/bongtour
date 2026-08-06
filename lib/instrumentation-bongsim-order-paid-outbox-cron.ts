/**
 * OrderPaid outbox 백업 드레인 — 1분마다 (production + DATABASE_URL).
 * 결제·무상발급은 kick(비블로킹); cron은 끊긴 kick·프로세스 재시작 복구.
 * REGRESSION-FREEZE[bongsim-order-paid-kick-nonblocking]: cron backup every minute — manifest
 */
import { drainOrderPaidOutboxBestEffort } from "@/lib/bongsim/fulfillment/process-order-paid-outbox";
import { drainEsimQrNotifyOutboxBestEffort } from "@/lib/bongsim/fulfillment/esim-qr-notify-outbox";

const CRON_EXPR = "* * * * *";

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
      }, 20_000);
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
    // REGRESSION-FREEZE[bongsim-esim-qr-notify-serialize]: cron also drains EsimQrNotify — manifest
    const notify = await drainEsimQrNotifyOutboxBestEffort(24);
    console.log("[bongsim-order-paid-outbox-cron] tick done", {
      trigger,
      ms: Date.now() - started,
      esim_qr_notify: notify,
    });
  } catch (e) {
    console.error("[bongsim-order-paid-outbox-cron] tick error", { trigger, e });
  }
}
