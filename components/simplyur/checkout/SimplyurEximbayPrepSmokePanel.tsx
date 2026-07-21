"use client";

import { useCallback, useState } from "react";
import type { EximbayRequestPayPayload } from "@/lib/simplyur/payments/eximbay-ready";
import { requestEximbayPay } from "@/lib/simplyur/payments/eximbay-sdk";

// REGRESSION-FREEZE[simplyur-eximbay-payment-prep]: optional prep smoke UI — manifest

type ReadyOk = {
  ok: true;
  smoke?: boolean;
  sdk_script_url: string;
  request_pay: EximbayRequestPayPayload;
};

type Props = {
  locale: string;
};

/**
 * Dev-only Eximbay FGKey + request_pay smoke. Hidden unless SIMPLYUR_EXIMBAY_PREP_UI=1.
 * Does not replace PortOne checkout.
 */
export function SimplyurEximbayPrepSmokePanel({ locale }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const runSmoke = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/simplyur/checkout/eximbay-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smoke: true, locale }),
      });
      const json = (await res.json()) as ReadyOk | { ok: false; error?: string; resmsg?: string };
      if (!json.ok || !("request_pay" in json)) {
        setMsg(`ready failed: ${"error" in json ? json.error : res.status} ${"resmsg" in json ? json.resmsg ?? "" : ""}`);
        return;
      }
      setMsg(`fgkey ok — opening Eximbay window (${json.request_pay.payment.amount} USD)`);
      await requestEximbayPay(json.sdk_script_url, json.request_pay);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "smoke_failed");
    } finally {
      setBusy(false);
    }
  }, [locale]);

  return (
    <aside
      style={{
        marginTop: 24,
        padding: 12,
        border: "1px dashed #999",
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      <strong>Eximbay prep smoke</strong>
      <p style={{ margin: "8px 0", color: "#666" }}>
        Calls payments/ready → FGKey → EXIMBAY.request_pay ($1). Not the live PortOne path.
      </p>
      <button type="button" disabled={busy} onClick={() => void runSmoke()}>
        {busy ? "…" : "Open Eximbay test window"}
      </button>
      {msg ? <p style={{ marginTop: 8 }}>{msg}</p> : null}
    </aside>
  );
}
