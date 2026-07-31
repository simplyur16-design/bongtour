/**
 * Simplyur client — Eximbay JavaScript SDK loader + request_pay types.
 * REGRESSION-FREEZE[simplyur-eximbay-payment-prep]: SDK load + request_pay — manifest
 * @see https://developer.eximbay.com/eximbay/api_sdk/javascript-sdk.html
 */
"use client";

import type { EximbayRequestPayPayload } from "@/lib/simplyur/payments/eximbay-ready";

export type EximbaySdkGlobal = {
  request_pay: (payload: EximbayRequestPayPayload) => void;
};

declare global {
  interface Window {
    EXIMBAY?: EximbaySdkGlobal;
  }
}

const SCRIPT_ATTR = "data-simplyur-eximbay-sdk";

export async function loadEximbaySdk(sdkScriptUrl: string): Promise<EximbaySdkGlobal> {
  if (typeof window === "undefined") {
    throw new Error("eximbay_sdk_browser_only");
  }
  if (window.EXIMBAY?.request_pay) return window.EXIMBAY;

  const existing = document.querySelector<HTMLScriptElement>(`script[${SCRIPT_ATTR}]`);
  if (existing) {
    await waitForEximbay(15_000);
    if (!window.EXIMBAY?.request_pay) throw new Error("eximbay_sdk_load_timeout");
    return window.EXIMBAY;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = sdkScriptUrl;
    script.async = true;
    script.setAttribute(SCRIPT_ATTR, "1");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("eximbay_sdk_script_error"));
    document.head.appendChild(script);
  });

  await waitForEximbay(15_000);
  if (!window.EXIMBAY?.request_pay) throw new Error("eximbay_sdk_unavailable");
  return window.EXIMBAY;
}

function waitForEximbay(ms: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (window.EXIMBAY?.request_pay) {
        resolve();
        return;
      }
      if (Date.now() - start > ms) {
        reject(new Error("eximbay_sdk_load_timeout"));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/** Call after loadEximbaySdk — params must match payments/ready body + fgkey. */
export async function requestEximbayPay(
  sdkScriptUrl: string,
  payload: EximbayRequestPayPayload,
): Promise<void> {
  const sdk = await loadEximbaySdk(sdkScriptUrl);
  sdk.request_pay(payload);
}

const EXIMBAY_UI_PRESENT_SELECTOR = [
  "iframe[src*='eximbay.com']",
  "iframe[src*='EXIMBAY']",
  "div[id*='eximbay']",
  "div[id*='Eximbay']",
  "div[class*='eximbay']",
  "div[class*='Eximbay']",
].join(", ");

/**
 * Eximbay `request_pay` returns immediately after opening a popup/overlay.
 * Poll until that UI is gone (cancel/close) so checkout can leave "Processing…".
 * REGRESSION-FREEZE[simplyur-eximbay-live-checkout]: unlock UI after cancel — manifest
 */
export function watchEximbayPayUntilClosed(opts?: {
  graceMs?: number;
  pollMs?: number;
  maxMs?: number;
  onClosed?: () => void;
}): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const graceMs = Math.max(400, opts?.graceMs ?? 2_000);
  const pollMs = Math.max(100, opts?.pollMs ?? 400);
  const maxMs = Math.max(graceMs + 1_000, opts?.maxMs ?? 10 * 60 * 1_000);
  const startedAt = Date.now();
  const opened: Window[] = [];
  let seen = false;
  let done = false;

  const origOpen = window.open.bind(window);
  window.open = ((...args: Parameters<Window["open"]>) => {
    const w = origOpen(...args);
    if (w) opened.push(w);
    return w;
  }) as typeof window.open;

  const finish = () => {
    if (done) return;
    done = true;
    cleanup();
    opts?.onClosed?.();
  };

  const uiPresent = () => {
    if (document.querySelector(EXIMBAY_UI_PRESENT_SELECTOR)) return true;
    for (const w of opened) {
      try {
        if (w && !w.closed) return true;
      } catch {
        /* cross-origin — treat as still open until closed throws differently */
        try {
          if (!w.closed) return true;
        } catch {
          return true;
        }
      }
    }
    return false;
  };

  const onFocusOrVisible = () => {
    // Parent regains focus after popup cancel/close (or user abandoned a blocked popup).
    if (Date.now() - startedAt < graceMs) return;
    if (!uiPresent()) finish();
  };

  const poll = window.setInterval(() => {
    const open = uiPresent();
    if (open) {
      seen = true;
      return;
    }
    // Only unlock on "seen then gone" — do not treat SDK-load delay as cancel.
    if (seen) finish();
  }, pollMs);

  const hardStop = window.setTimeout(() => {
    finish();
  }, maxMs);

  window.addEventListener("focus", onFocusOrVisible);
  document.addEventListener("visibilitychange", onFocusOrVisible);

  const cleanup = () => {
    window.clearInterval(poll);
    window.clearTimeout(hardStop);
    window.removeEventListener("focus", onFocusOrVisible);
    document.removeEventListener("visibilitychange", onFocusOrVisible);
    if (window.open !== origOpen) {
      window.open = origOpen;
    }
  };

  return () => {
    if (done) return;
    done = true;
    cleanup();
  };
}
