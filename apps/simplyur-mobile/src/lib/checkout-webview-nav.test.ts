// REGRESSION-FREEZE[simplyur-mobile-vitest-tsconfig]: standalone apps/simplyur-mobile/tsconfig (no expo extend) — manifest
// REGRESSION-FREEZE[simplyur-eximbay-app-install-optional]: store link optional — manifest
import { describe, expect, it } from 'vitest'
import {
  classifySimplyurCheckoutWebViewUrl,
  isExternalPaymentAppUrl,
  isOptionalAppStoreUrl,
} from './checkout-webview-nav'

describe('simplyur in-app checkout WebView nav', () => {
  it('detects payment complete (legacy website complete URL)', () => {
    expect(
      classifySimplyurCheckoutWebViewUrl(
        'https://bongtour.com/simplyur/en/checkout/complete?orderId=o1&orderNumber=N1',
      ),
    ).toEqual({ kind: 'complete', orderId: 'o1', orderNumber: 'N1' })
  })

  it('detects auth_ok sentinel for PAYER_AUTH → complete-pa', () => {
    expect(
      classifySimplyurCheckoutWebViewUrl(
        'https://bongtour.com/simplyur/en/app-pay-result?status=auth_ok&orderId=o1&orderNumber=N1&payer_auth_id=PA9',
      ),
    ).toEqual({
      kind: 'auth_ok',
      orderId: 'o1',
      orderNumber: 'N1',
      payerAuthId: 'PA9',
    })
  })

  it('maps status=ok app-pay-result to auth_ok (never unpaid complete)', () => {
    expect(
      classifySimplyurCheckoutWebViewUrl(
        'https://bongtour.com/simplyur/en/app-pay-result?status=ok&orderId=o1&orderNumber=N1',
      ),
    ).toEqual({
      kind: 'auth_ok',
      orderId: 'o1',
      orderNumber: 'N1',
      payerAuthId: '',
    })
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

  it('blocks website sign-in / login pages inside pay WebView', () => {
    expect(
      classifySimplyurCheckoutWebViewUrl('https://bongtour.com/simplyur/en/sign-in'),
    ).toEqual({ kind: 'cancel_or_fail' })
    expect(
      classifySimplyurCheckoutWebViewUrl('https://bongtour.com/api/auth/signin'),
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

  it('treats EXIMPay+ / Play Store as an optional link, not a required checkout step', () => {
    const play = 'https://play.google.com/store/apps/details?id=com.chainrefund.dmplus'
    expect(isOptionalAppStoreUrl(play)).toBe(true)
    expect(isExternalPaymentAppUrl(play)).toBe(false)
    expect(classifySimplyurCheckoutWebViewUrl(play)).toEqual({
      kind: 'optional_store_link',
      url: play,
    })
    expect(
      classifySimplyurCheckoutWebViewUrl('market://details?id=com.chainrefund.dmplus'),
    ).toEqual({
      kind: 'optional_store_link',
      url: 'market://details?id=com.chainrefund.dmplus',
    })
  })
})
