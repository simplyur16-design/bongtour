import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyTitleRestoreLockToProductUpdate,
  isTitleSupplierOriginalLocked,
  stripLockedTitleFieldsFromProductWrite,
  TITLE_SUPPLIER_ORIGINAL_LOCK_KEY,
} from '@/lib/product-title-restore-lock'

// REGRESSION-FREEZE[product-title-restore-lock]: 제목 복구 잠금 — manifest
const LOCK = { lockedAt: '2026-10-30T11:20:58.000Z', source: 'supplier_original', reason: 'owner 2026-10-30', restoredTitle: '싱가포르 5일' }
const LOCKED_META = JSON.stringify({ keep: 1, [TITLE_SUPPLIER_ORIGINAL_LOCK_KEY]: LOCK })

describe('product-title-restore-lock', () => {
  it('not locked for empty / bad / wrong source', () => {
    expect(isTitleSupplierOriginalLocked(null)).toBe(false)
    expect(isTitleSupplierOriginalLocked('not json')).toBe(false)
    expect(isTitleSupplierOriginalLocked('{"titleSupplierOriginalLock":{"source":"x","lockedAt":"t"}}')).toBe(false)
    expect(isTitleSupplierOriginalLocked(LOCKED_META)).toBe(true)
  })
  it('unlocked product: data unchanged (re-register may still write title)', () => {
    const data = { title: 'A', originalTitle: 'B', duration: '3박4일' }
    expect(stripLockedTitleFieldsFromProductWrite('{"keep":1}', data)).toBe(data)
  })
  it('locked product: drops title/originalTitle, keeps other fields, keeps lock in new rawMeta', () => {
    const out = stripLockedTitleFieldsFromProductWrite(LOCKED_META, {
      title: '[★출발확정★] 새 제목',
      originalTitle: '[★출발확정★] 새 제목',
      rawTitle: 'r',
      duration: '3박4일',
      rawMeta: JSON.stringify({ structuredSignals: { a: 1 } }),
    })
    expect(out).not.toHaveProperty('title')
    expect(out).not.toHaveProperty('originalTitle')
    expect(out.duration).toBe('3박4일')
    const meta = JSON.parse(out.rawMeta as string)
    expect(meta.structuredSignals).toEqual({ a: 1 })
    expect(meta[TITLE_SUPPLIER_ORIGINAL_LOCK_KEY]).toEqual(LOCK)
  })
  it('async helper reads existing rawMeta from db/tx', async () => {
    const db = { product: { findUnique: async () => ({ rawMeta: LOCKED_META }) } }
    const out = await applyTitleRestoreLockToProductUpdate(db, 'p1', { title: 'x', airline: 'KE' })
    expect(out).toEqual({ airline: 'KE' })
  })
  it('wired into the 7 register-flow existing-update paths and travel/parse upsert update', () => {
    const root = process.cwd()
    for (const s of ['hanatour', 'ybtour', 'lottetour', 'verygoodtour', 'modetour', 'naeiltour', 'kyowontour']) {
      const src = readFileSync(join(root, `lib/${s}-register-flow.ts`), 'utf8')
      expect(src, s).toContain('applyTitleRestoreLockToProductUpdate(')
      expect(src, s).toContain('REGRESSION-FREEZE[product-title-restore-lock]')
    }
    const parse = readFileSync(join(root, 'app/api/travel/parse/route.ts'), 'utf8')
    expect(parse).toContain('update: stripLockedTitleFieldsFromProductWrite(')
  })
})
