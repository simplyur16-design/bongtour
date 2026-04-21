import { usimsaRequest } from "@/lib/usimsa/client";

export type UsimsaProduct = {
  optionId: string;
  productName: string;
  price: number;
  days: number;
  quota: number;
  qos: number;
  isCancelable: boolean;
};

export type UsimsaProductsResponse = {
  products: UsimsaProduct[];
};

function toBooleanCancelable(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
  }
  return false;
}

function toFiniteNumber(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Usimsa product field "${field}" is not a finite number`);
  }
  return n;
}

function toNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Usimsa product field "${field}" must be a non-empty string`);
  }
  return value;
}

function normalizeProduct(raw: unknown): UsimsaProduct {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Usimsa product entry must be an object");
  }
  const o = raw as Record<string, unknown>;
  return {
    optionId: toNonEmptyString(o.optionId, "optionId"),
    productName: toNonEmptyString(o.productName, "productName"),
    price: toFiniteNumber(o.price, "price"),
    days: toFiniteNumber(o.days, "days"),
    quota: toFiniteNumber(o.quota, "quota"),
    qos: toFiniteNumber(o.qos, "qos"),
    isCancelable: toBooleanCancelable(o.isCancelable),
  };
}

export async function fetchUsimsaProducts(): Promise<UsimsaProduct[]> {
  const raw = await usimsaRequest<unknown>({ method: "GET", path: "/v2/products" });

  if (typeof raw !== "object" || raw === null) {
    throw new Error("Usimsa products response: expected JSON object");
  }

  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.products)) {
    throw new Error("Usimsa products response: missing or invalid products array");
  }

  return obj.products.map(normalizeProduct);
}
