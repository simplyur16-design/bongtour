import {
  submitUsimsaOrder,
  submitUsimsaUsimOrder,
} from "@/lib/bongsim/supplier/usimsa/order-api";
import type { UsimsaSubmitRequest } from "@/lib/bongsim/supplier/usimsa/types";
import { isUsimsaSuccess } from "@/lib/bongsim/supplier/usimsa/types";
import type {
  BongsimFulfillmentMode,
} from "@/lib/bongsim/catalog/sim-fulfillment";
import {
  parseFulfillmentMode,
  validateCustomerIccidsForQuantity,
} from "@/lib/bongsim/catalog/sim-fulfillment";
import type {
  BongsimSupplierClient,
  BongsimSupplierOrderLineInput,
  BongsimSupplierSubmitResult,
} from "@/lib/bongsim/supplier/supplier-types";

type ExpandedUnit = {
  option_api_id: string;
  fulfillment_mode: BongsimFulfillmentMode;
  iccid?: string;
};

/**
 * USIMSA supplier client.
 * REGRESSION-FREEZE[bongsim-usim-fulfillment]: eSIM /v2/order + USIM /v2/order/usim 분기 — manifest
 *
 * eSIM 라인 → POST /v2/order (qty 집계)
 * USIM 라인 → POST /v2/order/usim (ICCID당 1회)
 */
export class BongsimUsimsaSupplierClient implements BongsimSupplierClient {
  readonly id = "usimsa";

  async submitPaidOrder(input: {
    order_id: string;
    order_number: string;
    lines: BongsimSupplierOrderLineInput[];
  }): Promise<BongsimSupplierSubmitResult> {
    const units = expandLinesToUnits(input.lines);
    if (units.length === 0) {
      throw new Error("[usimsa] no line to submit");
    }

    const topups: NonNullable<BongsimSupplierSubmitResult["topups"]> = [];

    const esimUnits = units.filter((u) => u.fulfillment_mode === "esim");
    if (esimUnits.length > 0) {
      const products = aggregateEsimUnits(esimUnits);
      const body: UsimsaSubmitRequest = {
        orderId: input.order_number,
        products,
      };
      const res = await submitUsimsaOrder(body);

      if ("skipped" in res) {
        for (const p of products) {
          for (let i = 0; i < p.qty; i++) {
            topups.push({
              topup_id: `test_mode_${input.order_number}_${p.optionId}_${i}`,
              option_api_id: p.optionId,
              fulfillment_mode: "esim",
            });
          }
        }
      } else {
        if (!isUsimsaSuccess(res.code)) {
          throw new Error(
            `[usimsa] submit failed code=${res.code} message=${res.message || "<empty>"}`,
          );
        }
        if (!Array.isArray(res.products) || res.products.length === 0) {
          throw new Error("[usimsa] submit returned no products");
        }
        for (const p of res.products) {
          topups.push({
            topup_id: p.topupId,
            option_api_id: p.optionId,
            fulfillment_mode: "esim",
          });
        }
      }
    }

    const usimUnits = units.filter((u) => u.fulfillment_mode === "usim");
    let usimSeq = 0;
    for (const unit of usimUnits) {
      if (!unit.iccid) {
        throw new Error("[usimsa] usim unit missing iccid");
      }
      usimSeq += 1;
      const orderId =
        usimUnits.length === 1 && esimUnits.length === 0
          ? input.order_number
          : `${input.order_number}-u${usimSeq}`;
      const res = await submitUsimsaUsimOrder({
        orderId,
        optionId: unit.option_api_id,
        iccid: unit.iccid,
      });

      if ("skipped" in res) {
        topups.push({
          topup_id: res.topupId,
          option_api_id: unit.option_api_id,
          iccid: unit.iccid,
          fulfillment_mode: "usim",
        });
      } else {
        if (!isUsimsaSuccess(res.code)) {
          throw new Error(
            `[usimsa] usim submit failed code=${res.code} message=${res.message || "<empty>"}`,
          );
        }
        if (!res.topupId) {
          throw new Error("[usimsa] usim submit returned no topupId");
        }
        topups.push({
          topup_id: res.topupId,
          option_api_id: unit.option_api_id,
          iccid: unit.iccid,
          fulfillment_mode: "usim",
        });
      }
    }

    return {
      submission_id: `usimsa_${input.order_number}`,
      topups,
    };
  }
}

function readSnapshotFulfillment(snapshot: Record<string, unknown>): {
  mode: BongsimFulfillmentMode;
  iccids: string[];
} {
  const mode = parseFulfillmentMode(snapshot.fulfillment_mode);
  const raw = snapshot.customer_iccids;
  const iccids = Array.isArray(raw) ? raw.map((v) => String(v)) : [];
  return { mode, iccids };
}

function expandLinesToUnits(lines: BongsimSupplierOrderLineInput[]): ExpandedUnit[] {
  const out: ExpandedUnit[] = [];
  for (const line of lines) {
    const { mode, iccids } = readSnapshotFulfillment(line.snapshot);
    if (mode === "usim") {
      const v = validateCustomerIccidsForQuantity(line.quantity, iccids);
      if (!v.ok) {
        throw new Error(`[usimsa] invalid usim iccids: ${v.code}`);
      }
      for (const iccid of v.iccids) {
        out.push({
          option_api_id: line.option_api_id,
          fulfillment_mode: "usim",
          iccid,
        });
      }
    } else {
      for (let i = 0; i < line.quantity; i++) {
        out.push({
          option_api_id: line.option_api_id,
          fulfillment_mode: "esim",
        });
      }
    }
  }
  return out;
}

function aggregateEsimUnits(
  units: ExpandedUnit[],
): Array<{ optionId: string; qty: number }> {
  const map = new Map<string, number>();
  for (const unit of units) {
    const current = map.get(unit.option_api_id) ?? 0;
    map.set(unit.option_api_id, current + 1);
  }
  return Array.from(map.entries()).map(([optionId, qty]) => ({ optionId, qty }));
}
