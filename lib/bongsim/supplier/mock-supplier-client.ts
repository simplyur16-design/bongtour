import { randomBytes } from "node:crypto";
import type { BongsimSupplierClient, BongsimSupplierOrderLineInput, BongsimSupplierSubmitResult } from "@/lib/bongsim/supplier/supplier-types";

/** Mock supplier; selection wired in `supplier-client-registry.ts`. */
export class BongsimMockSupplierClient implements BongsimSupplierClient {
  readonly id = "bongsim_mock_supplier";

  async submitPaidOrder(input: { order_id: string; order_number: string; lines: BongsimSupplierOrderLineInput[] }): Promise<BongsimSupplierSubmitResult> {
    void input.lines;
    const suffix = randomBytes(4).toString("hex");
    return {
      submission_id: `mock_sub_${input.order_id.slice(0, 8)}_${suffix}`,
      profile_ref: `mock_prof_${suffix}`,
      iccid: `8901${suffix.slice(0, 12).padEnd(12, "0")}`,
    };
  }
}
