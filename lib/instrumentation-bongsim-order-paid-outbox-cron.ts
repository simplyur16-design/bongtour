/**
 * OrderPaid + EsimQrNotify 발급 드레인 — fulfill owner 프로세스에서만 등록.
 * 15초 interval + 1분 cron 백업. web은 BONGSIM_FULFILL_OWNER=worker|fulfill 시 등록 안 함.
 * REGRESSION-FREEZE[bongsim-fulfill-owner-split]: fulfill drain interval — manifest
 * REGRESSION-FREEZE[bongsim-order-paid-kick-nonblocking]: cron backup — manifest
 * REGRESSION-FREEZE[bongsim-fulfill-drain-saturated-retry]: saturated backoff — manifest
 */
import { drainOrderPaidOutboxBestEffort } from "@/lib/bongsim/fulfillment/process-order-paid-outbox";
import { drainEsimQrNotifyOutboxBestEffort } from "@/lib/bongsim/fulfillment/esim-qr-notify-outbox";
import { shouldRunFulfillmentCrons } from "@/lib/instrumentation-process-role";

const CRON_EXPR = "* * * * *";
/** 결제 직후 체감 지연 완화 — cron만 쓰면 최대 60초 대기 */
const INTERVAL_MS = Math.max(
  5_000,
  Number.parseInt(process.env.BONGSIM_FULFILL_DRAIN_INTERVAL_MS ?? "15000", 10) || 15_000,
);

const SATURATED_SKIP_MS = Math.max(
  15_000,
  Number.parseInt(process.env.BONGSIM_FULFILL_SATURATED_SKIP_MS ?? "60000", 10) || 60_000,
);

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.RAILWAY_ENVIRONMENT === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

export function shouldRegisterBongsimOrderPaidOutboxCron(): boolean {
  if (!(process.env.DATABASE_URL ?? "").trim()) {
    return false;
  }
  if (!isProductionRuntime()) {
    return false;
  }
  return shouldRunFulfillmentCrons();
}

export function startInstrumentationBongsimOrderPaidOutboxCron(): void {
  const hasDb = Boolean((process.env.DATABASE_URL ?? "").trim());
  const prod = isProductionRuntime();
  console.log("[bongsim-order-paid-outbox-cron] register() called", {
    nodeEnv: process.env.NODE_ENV ?? "(unset)",
    railwayEnv: process.env.RAILWAY_ENVIRONMENT ?? "(unset)",
    hasDb,
    productionRuntime: prod,
    fulfill: shouldRunFulfillmentCrons(),
    intervalMs: INTERVAL_MS,
    saturatedSkipMs: SATURATED_SKIP_MS,
    disabled: process.env.DISABLE_INSTRUMENTATION_BONGSIM_ORDER_PAID_OUTBOX_CRON === "1",
  });

  if (!shouldRegisterBongsimOrderPaidOutboxCron()) {
    console.warn(
      "[bongsim-order-paid-outbox-cron] register skipped (need DATABASE_URL + production + fulfill owner)",
    );
    return;
  }

  let tickInFlight = false;
  let saturatedSkipUntil = 0;
  const runTick = (trigger: "cron" | "boot" | "interval") => {
    if (tickInFlight) return;
    if (Date.now() < saturatedSkipUntil) {
      console.warn("[bongsim-order-paid-outbox-cron] saturated skip window", {
        trigger,
        until: new Date(saturatedSkipUntil).toISOString(),
      });
      return;
    }
    tickInFlight = true;
    void tickBongsimOrderPaidOutboxCron(trigger)
      .then((skipUntil) => {
        if (skipUntil != null) saturatedSkipUntil = skipUntil;
      })
      .finally(() => {
        tickInFlight = false;
      });
  };

  void import("node-cron")
    .then((m) => {
      const cron = m.default;
      cron.schedule(
        CRON_EXPR,
        () => {
          runTick("cron");
        },
        { timezone: "Asia/Seoul" },
      );
      console.log(`[bongsim-order-paid-outbox-cron] registered: ${CRON_EXPR} (Asia/Seoul)`);
      setInterval(() => {
        runTick("interval");
      }, INTERVAL_MS);
      console.log(`[bongsim-order-paid-outbox-cron] interval: ${INTERVAL_MS}ms`);
      setTimeout(() => {
        runTick("boot");
      }, 12_000);
    })
    .catch((e) => {
      console.error("[bongsim-order-paid-outbox-cron] failed to load node-cron", e);
    });
}

async function drainFulfillOutboxes(): Promise<{ processed: number; deferred: number }> {
  await drainOrderPaidOutboxBestEffort(16);
  // REGRESSION-FREEZE[bongsim-esim-qr-notify-serialize]: cron also drains EsimQrNotify — manifest
  return drainEsimQrNotifyOutboxBestEffort(24);
}

async function tickBongsimOrderPaidOutboxCron(
  trigger: "cron" | "boot" | "interval",
): Promise<number | null> {
  const started = Date.now();
  console.log("[bongsim-order-paid-outbox-cron] tick start", { trigger, at: new Date().toISOString() });
  try {
    if (!(process.env.DATABASE_URL ?? "").trim()) {
      console.warn("[bongsim-order-paid-outbox-cron] tick skip: DATABASE_URL");
      return null;
    }
    const notify = await drainFulfillOutboxes();
    console.log("[bongsim-order-paid-outbox-cron] tick done", {
      trigger,
      ms: Date.now() - started,
      esim_qr_notify: notify,
    });
    return null;
  } catch (e) {
    console.error("[bongsim-order-paid-outbox-cron] tick error", { trigger, e });
    try {
      const {
        classifyBongsimPgError,
        getBongsimPoolStats,
        healBongsimPgPoolForCatalog,
        resolveBongsimCatalogPoolMax,
        shouldBackoffInsteadOfHealOnConnectTimeout,
        shouldSkipCatalogHealBecauseSaturated,
        shouldSkipImmediateDrainRetryOnSaturatedTimeout,
      } = await import("@/lib/bongsim/db/pool");
      if (classifyBongsimPgError(e) !== "connection_timeout") return null;

      // REGRESSION-FREEZE[auth-login-emaxconn-retry]: EMAXCONN must not heal — manifest
      const stats = getBongsimPoolStats();
      const saturated =
        shouldSkipCatalogHealBecauseSaturated(e) ||
        shouldBackoffInsteadOfHealOnConnectTimeout(stats, resolveBongsimCatalogPoolMax());
      if (shouldSkipImmediateDrainRetryOnSaturatedTimeout(saturated)) {
        // 슬롯 포화 시 heal·즉시 재드레인은 옛 풀 end()+새 연결을 겹쳐 Supabase를 더 짓누른다.
        const skipUntil = Date.now() + SATURATED_SKIP_MS;
        console.warn("[bongsim-order-paid-outbox-cron] saturated backoff (no heal)", {
          stats,
          skipUntil: new Date(skipUntil).toISOString(),
          skipMs: SATURATED_SKIP_MS,
        });
        console.warn("[bongsim-order-paid-outbox-cron] saturated skip drain (no immediate retry)");
        return skipUntil;
      }

      await healBongsimPgPoolForCatalog("order-paid-outbox-cron-timeout");
      const notify = await drainFulfillOutboxes();
      console.log("[bongsim-order-paid-outbox-cron] tick done", {
        trigger,
        ms: Date.now() - started,
        esim_qr_notify: notify,
        recovered: "heal",
      });
      return null;
    } catch (e2) {
      console.error("[bongsim-order-paid-outbox-cron] tick error after recover", {
        trigger,
        e: e2,
      });
      return null;
    }
  }
}
