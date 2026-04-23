/** Supplier fulfillment; 구현·env: `supplier-client-registry.ts`. */
export type BongsimSupplierOrderLineInput = {
  option_api_id: string;
  quantity: number;
  /** Immutable purchase snapshot subset for supplier handoff. */
  snapshot: Record<string, unknown>;
};

/**
 * 공급사 submit 결과.
 *
 * - mock (동기형): `profile_ref`, `iccid` 즉시 반환.
 * - USIMSA 등 비동기형: `topups[]`만 반환. ICCID는 웹훅으로 개별 도착.
 *
 * 호출자는 `topups` 유무로 분기. `topups`가 있으면 비동기 경로.
 */
export type BongsimSupplierSubmitResult = {
  submission_id: string;
  profile_ref?: string;
  iccid?: string;
  /**
   * 비동기형 공급사가 반환하는 topup 목록.
   * 각 원소는 공급사 측 topup/iccid 자리표시자(ICCID는 아직 null).
   */
  topups?: Array<{
    topup_id: string;
    option_api_id: string;
  }>;
};

export interface BongsimSupplierClient {
  readonly id: string;
  submitPaidOrder(input: {
    order_id: string;
    order_number: string;
    lines: BongsimSupplierOrderLineInput[];
  }): Promise<BongsimSupplierSubmitResult>;
}
