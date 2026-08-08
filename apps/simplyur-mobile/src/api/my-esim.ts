import type { SimplyurLocale } from '@/src/constants/simplyur';
import { getApiBaseUrl } from '@/src/constants/simplyur';
import { getSimplyurAccessToken } from '@/src/lib/session';

export type MyEsimOrder = {
  option_api_id?: string;
  order_id: string;
  order_number: string;
  status_key: string;
  plan_summary: string;
  grand_total_krw: string;
  created_at: string;
  qr_code_img_url: string | null;
  sm_dp_plus_address: string | null;
  activation_code: string | null;
  can_show_qr: boolean;
  can_check_usage: boolean;
};

export type MyEsimUsage = {
  total_used_mb: number;
  unlimited: boolean;
  cap_mb: number | null;
  history: { date: string; usageMb: number }[];
};

async function authHeaders(): Promise<HeadersInit> {
  const token = await getSimplyurAccessToken();
  const h: Record<string, string> = { Accept: 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function fetchMyEsimOrders(
  locale: SimplyurLocale,
): Promise<{ ok: true; orders: MyEsimOrder[] } | { ok: false; unauthorized: boolean; error?: string }> {
  const url = `${getApiBaseUrl()}/api/simplyur/mypage/orders?locale=${encodeURIComponent(locale)}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: await authHeaders(),
  });
  const json = (await res.json()) as { orders?: MyEsimOrder[]; error?: string };
  if (res.status === 401) return { ok: false, unauthorized: true };
  if (!res.ok) return { ok: false, unauthorized: false, error: json.error };
  return { ok: true, orders: json.orders ?? [] };
}

export async function fetchMyEsimUsage(orderId: string): Promise<MyEsimUsage | null> {
  const url = `${getApiBaseUrl()}/api/simplyur/mypage/usage?orderId=${encodeURIComponent(orderId)}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: await authHeaders(),
  });
  if (!res.ok) return null;
  return (await res.json()) as MyEsimUsage;
}
