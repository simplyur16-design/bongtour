import { describe, expect, it } from 'vitest';

import { isKoreaMobileForSms, qrExtraChannelOrder } from './korea-mobile';

describe('isKoreaMobileForSms', () => {
  it('accepts Korean mobiles in local and +82 form', () => {
    expect(isKoreaMobileForSms('010-1234-5678')).toBe(true);
    expect(isKoreaMobileForSms('+82 10 1234 5678')).toBe(true);
    expect(isKoreaMobileForSms('8201012345678')).toBe(true);
  });

  it('rejects overseas and Korean landline numbers', () => {
    expect(isKoreaMobileForSms('+1 415 555 0100')).toBe(false);
    expect(isKoreaMobileForSms('+81 90 1234 5678')).toBe(false);
    expect(isKoreaMobileForSms('02-123-4567')).toBe(false);
    expect(isKoreaMobileForSms('')).toBe(false);
  });
});

describe('qrExtraChannelOrder', () => {
  it('puts WeChat first for Chinese locales', () => {
    expect(qrExtraChannelOrder('zh')[0]).toBe('wechat');
    expect(qrExtraChannelOrder('zh-TW')[0]).toBe('wechat');
    expect(qrExtraChannelOrder('en')[0]).toBe('none');
  });
});
