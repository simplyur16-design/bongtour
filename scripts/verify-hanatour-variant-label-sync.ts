/**
 * hanatour-product-sync: variantLabelKey가 update 객체에 빠지지 않고 null로 정규화되는지.
 *   npx tsx scripts/verify-hanatour-variant-label-sync.ts
 */
import { prismaProductUpdateFromHanatourPayload } from '../lib/hanatour-product-sync'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const a = prismaProductUpdateFromHanatourPayload({
  variantLabelKey: '  도쿄 3일  ',
  rawTitle: 'x',
})
assert(a.variantLabelKey === '도쿄 3일', 'trim variantLabelKey')

const b = prismaProductUpdateFromHanatourPayload({
  variantLabelKey: undefined,
  rawTitle: 'x',
})
assert(Object.prototype.hasOwnProperty.call(b, 'variantLabelKey'), 'key present')
assert(b.variantLabelKey === null, 'undefined -> null')

const c = prismaProductUpdateFromHanatourPayload({
  variantLabelKey: '',
  rawTitle: 'x',
})
assert(c.variantLabelKey === null, 'empty -> null')

console.log('verify-hanatour-variant-label-sync: ok')
