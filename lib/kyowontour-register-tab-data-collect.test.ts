/**
 * REGRESSION-FREEZE[kyowontour-tour-event-tab-opt-shop]
 */
import { describe, expect, it } from 'vitest'
import {
  needsKyowontourIncludedExcludedCollect,
  needsKyowontourMustKnowCollect,
} from './kyowontour-register-tab-data-collect'
import type { RegisterParsed } from './register-llm-schema-kyowontour'

describe('kyowontour register tab data collect gates', () => {
  it('needs included/excluded when both missing', () => {
    expect(needsKyowontourIncludedExcludedCollect({} as RegisterParsed)).toBe(true)
    expect(
      needsKyowontourIncludedExcludedCollect({
        includedText: '항공권',
        excludedText: '팁',
      } as RegisterParsed),
    ).toBe(false)
  })

  it('needs mustKnow when empty', () => {
    expect(needsKyowontourMustKnowCollect({} as RegisterParsed)).toBe(true)
    expect(
      needsKyowontourMustKnowCollect({
        mustKnowItems: [{ category: '안전/유의', title: 't', body: 'b' }],
      } as RegisterParsed),
    ).toBe(false)
  })
})
