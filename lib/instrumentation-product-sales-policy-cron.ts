/**
 * 트랙 ⑥ 상품 노출·판매 정책 — 5분마다 1상품 라이브 검증 cron.
 *
 * 흐름 (`tickProductSalesPolicyCron`):
 *   1. `pickNextProductToCheck(prisma)` — `lastSalesPolicyCheckedAt` 가장 오래된 상품 1건 (NULL 우선).
 *   2. `runOneSalesPolicyCheck(prisma, product)` — 90일 1회 라이브 fetch + Product 마커 3종 갱신.
 *      트랙 ⑤ B' 가드(throttle / lock / human delay) 재사용.
 *   3. 결과 1줄 콘솔 로그.
 *
 * 사이클 추정: 등록 상품 ~120건 × 5분 = ~10시간/사이클. 룰 A·B 정확도(D-7 단위)에 영향 0.
 *
 * 등록·해제: `instrumentation.ts` 의 production 가드(NEXT_RUNTIME=nodejs && NODE_ENV=production) 안에서
 *   `startInstrumentationProductSalesPolicyCron()` 1줄 호출 (2-D).
 *
 * 비활성화: `DISABLE_INSTRUMENTATION_PRODUCT_SALES_POLICY_CRON=1` (운영 응급 차단용).
 */
export function startInstrumentationProductSalesPolicyCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_PRODUCT_SALES_POLICY_CRON === '1') {
    return
  }
  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '*/5 * * * *',
        () => {
          void tickProductSalesPolicyCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[product-sales-policy-cron] registered: */5 * * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[product-sales-policy-cron] failed to load node-cron', e)
    })
}

async function tickProductSalesPolicyCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[product-sales-policy-cron] skip: DATABASE_URL')
      return
    }
    const { prisma } = await import('@/lib/prisma')
    const { pickNextProductToCheck, runOneSalesPolicyCheck } = await import(
      '@/lib/product-sales-policy'
    )
    const product = await pickNextProductToCheck(prisma)
    if (!product) {
      // 대상 0건 — 등록·해외/국내 상품 자체가 없거나 (사실상 발생 X), 모든 상품 처리 1회 사이클 완료 직후의 race(수 ms).
      console.log('[product-sales-policy-cron] tick skip: no candidate')
      return
    }
    const result = await runOneSalesPolicyCheck(prisma, product)
    const lastFut = result.lastFutureDate ? result.lastFutureDate.toISOString().slice(0, 10) : null
    console.log(
      `[product-sales-policy-cron] productId=${product.id} supplier=${result.supplierKey ?? 'n/a'} marked=${result.marked} lastFut=${lastFut ?? 'null'} skipReason=${result.skipReason ?? 'none'}`,
    )
  } catch (e) {
    // 다음 trigger 까지 대기 — cron 자체는 멈추지 않는다 (node-cron 은 tick 함수 throw 를 흡수).
    console.error('[product-sales-policy-cron] error', e)
  }
}
