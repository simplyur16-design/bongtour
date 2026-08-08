import { describe, expect, it } from 'vitest'
import {
  classifySimplyurCheckoutWebViewUrl,
  isExternalPaymentAppUrl,
} from './checkout-webview-nav'

describe('simplyur in-app checkout WebView nav', () => {
  it('detects payment complete', () => {
    expect(
      classifySimplyurCheckoutWebViewUrl(
        'https://bongtour.com/simplyur/en/checkout/complete?orderId=o1&orderNumber=N1',
      ),
    ).toEqual({ kind: 'complete', orderId: 'o1', orderNumber: 'N1' })
  })

  it('detects cancel/fail resume', () => {
    expect(
      classifySimplyurCheckoutWebViewUrl(
        'https://bongtour.com/simplyur/en/checkout?optionApiId=x&failed=1',
      ),
    ).toEqual({ kind: 'cancel_or_fail' })
  })

  it('detects app-pay-result fail sentinel (no website checkout chrome)', () => {
    expect(
      classifySimplyurCheckoutWebViewUrl(
        'https://bongtour.com/simplyur/en/app-pay-result?status=fail',
      ),
    ).toEqual({ kind: 'cancel_or_fail' })
  })

  it('treats website checkout page as cancel (stay on native form)', () => {
    expect(
      classifySimplyurCheckoutWebViewUrl(
        'https://bongtour.com/simplyur/en/checkout?optionApiId=x',
      ),
    ).toEqual({ kind: 'cancel_or_fail' })
  })

  it('keeps Eximbay / card issuer https in WebView', () => {
    expect(
      classifySimplyurCheckoutWebViewUrl('https://api.eximbay.com/v1/payments/something'),
    ).toEqual({ kind: 'continue' })
  })

  it('classifies Alipay/WeChat-style app schemes as blocked external (no handoff)', () => {
    expect(isExternalPaymentAppUrl('alipays://platformapi/startapp')).toBe(true)
    expect(
      classifySimplyurCheckoutWebViewUrl('alipays://platformapi/startapp'),
    ).toEqual({ kind: 'external_app', url: 'alipays://platformapi/startapp' })
  })
})
