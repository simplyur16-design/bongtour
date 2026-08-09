/**
 * REGRESSION-FREEZE[simplyur-mobile-p1-account-settings]: withdraw client — manifest
 */
import { getApiBaseUrl } from '@/src/constants/simplyur';
import { getSimplyurAccessToken } from '@/src/lib/session';

export async function requestSimplyurAccountWithdraw(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const token = await getSimplyurAccessToken();
  if (!token) return { ok: false, error: 'login_required' };

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/simplyur/account/withdraw`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      let error = `http_${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) error = body.error;
      } catch {
        /* ignore */
      }
      return { ok: false, error };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'network' };
  }
}
