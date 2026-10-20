/**
 * draft-local 디자인 목업 — production 404.
 * REGRESSION-FREEZE[bongtour-ocean-warm-design-l0]: /dev 디자인 프리뷰 prod 차단 — manifest
 */

import { notFound } from 'next/navigation'

export function assertDevDesignPreviewAllowed(): void {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }
}
