/**
 * 6공급사 일 1회 가격 sweep cron 등록 — worker SSOT, web 단독 배포 시 fallback.
 *
 * REGRESSION-FREEZE[supplier-sweep-web-fallback]: web-only Railway — manifest
 */

export function isWebSupplierSweepCronDisabled(): boolean {
  return process.env.DISABLE_WEB_SUPPLIER_SWEEP_CRON === '1'
}

/** modetour·hanatour·ybtour·lottetour·verygoodtour·kyowontour 일 1회 sweep */
export async function registerSupplierSweepCrons(): Promise<void> {
  const [
    { startInstrumentationModetourSweepCron },
    { startInstrumentationHanatourSweepCron },
    { startInstrumentationYbtourSweepCron },
    { startInstrumentationLottetourSweepCron },
    { startInstrumentationVerygoodtourSweepCron },
    { startInstrumentationKyowontourSweepCron },
  ] = await Promise.all([
    import('@/lib/instrumentation-modetour-sweep-cron'),
    import('@/lib/instrumentation-hanatour-sweep-cron'),
    import('@/lib/instrumentation-ybtour-sweep-cron'),
    import('@/lib/instrumentation-lottetour-sweep-cron'),
    import('@/lib/instrumentation-verygoodtour-sweep-cron'),
    import('@/lib/instrumentation-kyowontour-sweep-cron'),
  ])

  startInstrumentationModetourSweepCron()
  startInstrumentationHanatourSweepCron()
  startInstrumentationYbtourSweepCron()
  startInstrumentationLottetourSweepCron()
  startInstrumentationVerygoodtourSweepCron()
  startInstrumentationKyowontourSweepCron()
}
