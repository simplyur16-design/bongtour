"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MyEsimView } from "@/lib/simplyur/my-esim-design";
import type { MyEsimOrderRow, MyEsimUsageResponse } from "@/lib/simplyur/my-esim-view-model";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import { SimplyurMyEsimPanel } from "@/components/simplyur/my-esim/SimplyurMyEsimPanel";

export function SimplyurMyEsimClient() {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();
  const [orders, setOrders] = useState<MyEsimOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailUsage, setDetailUsage] = useState<MyEsimUsageResponse | null>(null);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [usageModalLoading, setUsageModalLoading] = useState(false);
  const [usageModalError, setUsageModalError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setUnauthorized(false);
    try {
      const res = await fetch(`/api/simplyur/mypage/orders?locale=${encodeURIComponent(locale)}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 401) {
        setUnauthorized(true);
        setOrders([]);
        return;
      }
      const j = (await res.json()) as { orders?: MyEsimOrderRow[] };
      if (!res.ok) throw new Error("load_failed");
      setOrders(j.orders ?? []);
    } catch {
      setLoadError(true);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.order_id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const fetchUsage = useCallback(async (orderId: string) => {
    setUsageModalLoading(true);
    setUsageModalError(null);
    try {
      const res = await fetch(`/api/simplyur/mypage/usage?orderId=${encodeURIComponent(orderId)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const j = (await res.json()) as MyEsimUsageResponse & { error?: string };
      if (!res.ok) throw new Error(j.error ?? "usage_failed");
      setDetailUsage(j);
    } catch {
      setDetailUsage(null);
      setUsageModalError(tr("myEsim.usageError"));
    } finally {
      setUsageModalLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    if (!selectedOrderId || !selectedOrder?.can_check_usage) {
      setDetailUsage(null);
      return;
    }
    void fetchUsage(selectedOrderId);
  }, [selectedOrderId, selectedOrder?.can_check_usage, fetchUsage]);

  const view: MyEsimView = useMemo(() => {
    if (loading) return "loading";
    if (unauthorized) return "signin";
    if (loadError) return "empty";
    if (selectedOrderId && selectedOrder) return "detail";
    if (orders.length === 0) return "empty";
    return "list";
  }, [loading, unauthorized, loadError, selectedOrderId, selectedOrder, orders.length]);

  function onSelectOrder(orderId: string) {
    setSelectedOrderId(orderId);
    setUsageModalOpen(false);
    setDetailUsage(null);
  }

  function onBackToList() {
    setSelectedOrderId(null);
    setUsageModalOpen(false);
    setDetailUsage(null);
  }

  function onOpenUsageModal() {
    setUsageModalOpen(true);
    if (selectedOrderId && selectedOrder?.can_check_usage && !detailUsage && !usageModalLoading) {
      void fetchUsage(selectedOrderId);
    }
  }

  return (
    <SimplyurMyEsimPanel
      view={view}
      orders={orders}
      selectedOrder={selectedOrder}
      detailUsage={detailUsage}
      usageModalOpen={usageModalOpen}
      usageModalLoading={usageModalLoading}
      usageModalError={usageModalError}
      loadError={loadError}
      onSelectOrder={onSelectOrder}
      onBackToList={onBackToList}
      onOpenUsageModal={onOpenUsageModal}
      onCloseUsageModal={() => setUsageModalOpen(false)}
    />
  );
}
