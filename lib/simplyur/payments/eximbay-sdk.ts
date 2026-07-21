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
