/**
 * Lightweight online probe — no native NetInfo module (avoids rebuild-only deps).
 * REGRESSION-FREEZE[simplyur-mobile-p2-polish]: network probe — manifest
 */
import { getApiBaseUrl } from '../constants/simplyur';

export async function probeSimplyurOnline(timeoutMs = 4000): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    return res.ok || res.status === 503;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
