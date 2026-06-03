import { describe, expect, it } from 'vitest'
import {
  consumeProductDetailPerf,
  patchProductDetailPerf,
  resetProductDetailPerf,
} from '@/lib/product-detail-perf'

describe('product-detail-perf snapshot', () => {
  it('merges patches and consumes once', () => {
    resetProductDetailPerf()
    patchProductDetailPerf({ selectKind: 'slim', parseMs: 3 })
    patchProductDetailPerf({ payloadBytes: 1200, payloadSource: 'payload', viewMs: 40 })
    const snap = consumeProductDetailPerf()
    expect(snap).toEqual({
      selectKind: 'slim',
      parseMs: 3,
      payloadBytes: 1200,
      payloadSource: 'payload',
      viewMs: 40,
    })
    expect(consumeProductDetailPerf()).toBeNull()
  })
})
