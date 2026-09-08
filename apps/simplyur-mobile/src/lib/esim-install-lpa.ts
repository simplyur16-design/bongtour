/**
 * GSMA LPA for in-app QR + one-tap OS install.
 * REGRESSION-FREEZE[simplyur-my-esim-paid-qr-install]: reconstruct LPA; never fake QR art — manifest
 */

const APPLE_ESIM_QR_PROVISIONING_BASE =
  'https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=';
const ANDROID_ESIM_QR_PROVISIONING_BASE =
  'https://esimsetup.android.com/esim_qrcode_provisioning?carddata=';

export function resolveEsimInstallLpa(params: {
  download_link?: string | null;
  sm_dp_plus_address?: string | null;
  activation_code?: string | null;
  apple_quick_install_url?: string | null;
}): string | null {
  const dl = params.download_link?.trim() ?? '';
  if (dl.startsWith('LPA:')) return dl;
  const code = params.activation_code?.trim() ?? '';
  if (code.startsWith('LPA:')) return code;
  const smdp = params.sm_dp_plus_address?.trim() ?? '';
  if (smdp && code) return `LPA:1$${smdp}$${code}`;
  return lpaFromAppleInstallUrl(params.apple_quick_install_url);
}

export function lpaFromAppleInstallUrl(url?: string | null): string | null {
  const raw = url?.trim() ?? '';
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const card = u.searchParams.get('carddata')?.trim() ?? '';
    return card.startsWith('LPA:') ? card : null;
  } catch {
    return null;
  }
}

export function buildAppleQuickInstallUrl(lpa: string): string | null {
  const code = lpa.trim();
  if (!code.startsWith('LPA:')) return null;
  return `${APPLE_ESIM_QR_PROVISIONING_BASE}${encodeURIComponent(code)}`;
}

export function buildAndroidQuickInstallUrl(lpa: string): string | null {
  const code = lpa.trim();
  if (!code.startsWith('LPA:')) return null;
  return `${ANDROID_ESIM_QR_PROVISIONING_BASE}${encodeURIComponent(code)}`;
}
