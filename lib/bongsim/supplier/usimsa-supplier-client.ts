import { submitUsimsaOrder } from "@/lib/bongsim/supplier/usimsa/order-api";
import type { UsimsaSubmitRequest } from "@/lib/bongsim/supplier/usimsa/types";
import { isUsimsaSuccess } from "@/lib/bongsim/supplier/usimsa/types";
import type {
  BongsimSupplierClient,
  BongsimSupplierOrderLineInput,
  BongsimSupplierSubmitResult,
} from "@/lib/bongsim/supplier/supplier-types";

/**
 * USIMSA supplier client.
 *
 * 동작:
 *   1) 주문 라인을 optionId 단위로 집계 (같은 optionId 중복 라인 → qty 합산)
 *   2) POST /v2/order 호출
 *   3) 응답의 products[]를 `topups` 배열로 변환 후 반환.
 *   4) ICCID·QR 등 실제 발급 정보는 나중에 웹훅으로 도착 → `webhook-parser.ts`가 처리.
 *
 * submission_id 규칙:
 *   USIMSA 스펙상 주문 전체에 대한 단일 ID가 없으므로,
 *   `usimsa_<orderNumber>` 형태를 합성해서 반환. (감사·추적용)
 */
export class BongsimUsimsaSupplierClient implements BongsimSupplierClient {
  readonly id = "usimsa";

  async submitPaidOrder(input: {
    order_id: string;
    order_number: string;
    lines: BongsimSupplierOrderLineInput[];
  }): Promise<BongsimSupplierSubmitResult> {
    const products = aggregateLinesToUsimsaProducts(input.lines);
    if (products.length === 0) {
      throw new Error("[usimsa] no line to submit");
    }

    const body: UsimsaSubmitRequest = {
      orderId: input.order_number,
      products,
    };

    const res = await submitUsimsaOrder(body);

    if (!isUsimsaSuccess(res.code)) {
      throw new Error(
        `[usimsa] submit failed code=${res.code} message=${res.message || "<empty>"}`,
      );
    }
    if (!Array.isArray(res.products) || res.products.length === 0) {
      throw new Error("[usimsa] submit returned no products");
    }

    return {
      submission_id: `usimsa_${input.order_number}`,
      topups: res.products.map((p) => ({
        topup_id: p.topupId,
        option_api_id: p.optionId,
      })),
    };
  }
}

/**
 * 같은 option_api_id를 가진 여러 라인을 하나로 합친다.
 * USIMSA는 `{ optionId, qty }` 형태로 받으므로 중복 optionId를 보내지 않음.
 */
function aggregateLinesToUsimsaProducts(
  lines: BongsimSupplierOrderLineInput[],
): Array<{ optionId: string; qty: number }> {
  const map = new Map<string, number>();
  for (const line of lines) {
    const current = map.get(line.option_api_id) ?? 0;
    map.set(line.option_api_id, current + line.quantity);
  }
  return Array.from(map.entries()).map(([optionId, qty]) => ({ optionId, qty }));
}
