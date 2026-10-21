import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { REGISTER_PRE_PHOTO_PENDING_LIST_ORDER_BY } from '@/lib/register-compare-cluster-gap-priority'

describe('pending-compare-gap-priority', () => {
  // REGRESSION-FREEZE[pending-compare-gap-priority]: orderBy gap then updatedAt — manifest
  it('pending list orderBy is gap priority then updatedAt desc', () => {
    expect(REGISTER_PRE_PHOTO_PENDING_LIST_ORDER_BY).toEqual([
      { registerCompareClusterGapPriority: 'desc' },
      { updatedAt: 'desc' },
    ])
  })

  it('wires stamp + pending route + schema', () => {
    const ssot = readFileSync(
      path.join(process.cwd(), 'lib/register-compare-cluster-gap-priority.ts'),
      'utf8',
    )
    const ingest = readFileSync(
      path.join(process.cwd(), 'lib/compare-cluster-supplier-gap-ingest.ts'),
      'utf8',
    )
    const route = readFileSync(
      path.join(process.cwd(), 'app/api/admin/products/pending/route.ts'),
      'utf8',
    )
    const schema = readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    expect(ssot).toContain('markProductCompareClusterGapPriority')
    expect(ingest).toContain('markProductCompareClusterGapPriority')
    expect(route).toContain('REGISTER_PRE_PHOTO_PENDING_LIST_ORDER_BY')
    expect(route).toContain('registerCompareClusterGapPriority')
    expect(route).not.toMatch(/orderBy:\s*\{\s*updatedAt:\s*'desc'\s*\}/)
    expect(schema).toContain('registerCompareClusterGapPriority')
  })
})
