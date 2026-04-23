/**
 * Supplier / fulfillment submission — 실 공급사 API 교체 지점.
 *
 * - Mock: `BONGSIM_SUPPLIER_CLIENT_ID` 미설정 또는 `bongsim_mock_supplier`.
 * - USIMSA: `BONGSIM_SUPPLIER_CLIENT_ID=usimsa` + `USIMSA_ACCESS_KEY` / `USIMSA_SECRET_KEY`.
 *
 * 새 공급사 추가 시:
 *   1) `BongsimSupplierClient` 구현체 작성
 *   2) 아래 `switch`에 케이스 추가
 *   3) `BONGSIM_SUPPLIER_CLIENT_ID` 값 문서화
 *
 * Env 계약: `lib/bongsim/integration/env-contract.ts`
 */
import { BongsimMockSupplierClient } from "@/lib/bongsim/supplier/mock-supplier-client";
import { BongsimUsimsaSupplierClient } from "@/lib/bongsim/supplier/usimsa-supplier-client";
import type { BongsimSupplierClient } from "@/lib/bongsim/supplier/supplier-types";

const MOCK_ID = "bongsim_mock_supplier";
const USIMSA_ID = "usimsa";

export function getDefaultSupplierClient(): BongsimSupplierClient {
  const id = process.env.BONGSIM_SUPPLIER_CLIENT_ID?.trim() || MOCK_ID;
  switch (id) {
    case MOCK_ID:
      return new BongsimMockSupplierClient();
    case USIMSA_ID:
      return new BongsimUsimsaSupplierClient();
    default:
      throw new Error(
        `[bongsim] Unknown BONGSIM_SUPPLIER_CLIENT_ID="${id}". Implement it in supplier-client-registry.ts or unset to use mock.`,
      );
  }
}

/**
 * 비동기형 공급사 여부 (submit 응답에 ICCID 없이 topup만 반환).
 * fulfillment runner가 분기하는 데 사용.
 */
export function isAsyncSupplier(id: string): boolean {
  return id === USIMSA_ID;
}
