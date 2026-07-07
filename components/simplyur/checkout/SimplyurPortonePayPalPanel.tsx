"use client";

import { useEffect, useRef } from "react";
import type { BongsimPaymentSessionClientV1 } from "@/lib/bongsim/contracts/payment-session.v1";
import { loadSimplyurPortonePayPalUi } from "@/lib/simplyur/payments/request-simplyur-portone-payment";

type Props = {
  client: Extract<BongsimPaymentSessionClientV1, { kind: "portone_v2" }>;
  onPaid: () => void;
  onFail: (message: string) => void;
};

/** PayPal SPB button host — requires `.portone-ui-container` per PortOne docs. */
export function SimplyurPortonePayPalPanel({ client, onPaid, onFail }: Props) {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (client.portone_method !== "paypal" || loadedRef.current) return;
    loadedRef.current = true;

    void loadSimplyurPortonePayPalUi(client, {
      onSuccess: onPaid,
      onFail,
    }).catch((e) => {
      onFail(e instanceof Error ? e.message : "PayPal could not load.");
    });
  }, [client, onPaid, onFail]);

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-[color:var(--su-ink-muted)]">Pay with PayPal</p>
      <div className="portone-ui-container min-h-[48px]" />
    </div>
  );
}
