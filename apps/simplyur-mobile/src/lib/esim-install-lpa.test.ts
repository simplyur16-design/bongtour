import { describe, expect, it } from 'vitest';

import {
  buildAndroidQuickInstallUrl,
  buildAppleQuickInstallUrl,
  resolveEsimInstallLpa,
} from './esim-install-lpa';

describe('resolveEsimInstallLpa', () => {
  it('rebuilds LPA from SM-DP+ and activation code', () => {
    expect(
      resolveEsimInstallLpa({
        sm_dp_plus_address: 'consumer.rsp.world',
        activation_code: 'ABCDEF123456',
      }),
    ).toBe('LPA:1$consumer.rsp.world$ABCDEF123456');
  });

  it('decodes LPA from Apple one-tap URL', () => {
    const lpa = 'LPA:1$smdp$code';
    const apple = buildAppleQuickInstallUrl(lpa);
    expect(apple).toContain('esimsetup.apple.com');
    expect(resolveEsimInstallLpa({ apple_quick_install_url: apple })).toBe(lpa);
    expect(buildAndroidQuickInstallUrl(lpa)).toContain('esimsetup.android.com');
  });
});
