/**
 * generateMonthlyCuration 동시 실행 중복 방지 (mocked prisma, DB/원격 호출 없음).
 * 사전 count(트랜잭션 밖)는 둘 다 0을 보지만, advisory xact lock + 트랜잭션 내 재확인으로
 * 동일 monthKey/pageScope 에 한 번만 create 되어야 한다.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const generateContent = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    monthlyCurationContent: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: { findMany: vi.fn() },
    curationEvent: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/gemini-client', () => ({
  getGenAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({ generateContent })),
  })),
  getModelName: vi.fn(() => 'gemini-2.5-flash'),
  geminiTimeoutOpts: vi.fn(() => ({ timeout: 120_000 })),
}))

vi.mock('@/lib/bong-marketing/curation-event-repository', () => ({
  getApprovedCurationEventsForMonth: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getApprovedCurationEventsForMonth } from '@/lib/bong-marketing/curation-event-repository'
import { generateMonthlyCuration, monthlyCurationWriteLockKey } from '@/lib/gemini-curation'

const PRODUCT = {
  id: 'prod-1',
  title: '다낭 4일',
  primaryDestination: '다낭',
  destination: '다낭',
  duration: '3박4일',
  bgImageUrl: null,
  continent: '동남아',
  country: '베트남',
  city: '다낭',
  prices: [],
}

type Row = { id: string; monthKey: string; pageScope: string; sortOrder: number; title: string; linkedProductId: string | null }

/** 인메모리 테이블 + 키별 직렬화 잠금(= pg_advisory_xact_lock 의미론) */
function installFakeDb() {
  const rows: Row[] = []
  const lockTails = new Map<string, Promise<void>>()
  const lockCalls: string[] = []
  let seq = 0
  const countRows = (where: { monthKey: string; pageScope: string }) =>
    rows.filter((r) => r.monthKey === where.monthKey && r.pageScope === where.pageScope).length

  vi.mocked(prisma.monthlyCurationContent.count).mockImplementation((async (args: {
    where: { monthKey: string; pageScope: string }
  }) => countRows(args.where)) as never)
  vi.mocked(prisma.monthlyCurationContent.findMany).mockImplementation((async (args: {
    where: { monthKey: string; pageScope: string }
  }) =>
    rows
      .filter((r) => r.monthKey === args.where.monthKey && r.pageScope === args.where.pageScope)
      .map(({ id, title, linkedProductId, sortOrder }) => ({ id, title, linkedProductId, sortOrder }))) as never)

  const txCreate = vi.fn()
  vi.mocked(prisma.$transaction).mockImplementation((async (cb: (tx: unknown) => Promise<unknown>) => {
    let release: () => void = () => {}
    let heldKey: string | null = null
    const staged: Row[] = []
    const tx = {
      $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        expect(strings.join('?')).toContain('pg_advisory_xact_lock')
        const key = String(values[0])
        lockCalls.push(key)
        const prev = lockTails.get(key) ?? Promise.resolve()
        const mine = new Promise<void>((r) => {
          release = r
        })
        lockTails.set(key, prev.then(() => mine))
        heldKey = key
        await prev
        return 1
      }),
      monthlyCurationContent: {
        count: vi.fn(async (args: { where: { monthKey: string; pageScope: string } }) => countRows(args.where)),
        deleteMany: vi.fn(async () => ({ count: 0 })),
        create: txCreate.mockImplementation(async (args: { data: Row }) => {
          const row = { ...args.data, id: `card-${++seq}` }
          staged.push(row)
          // 다른 트랜잭션이 끼어들 틈 제공
          await new Promise((r) => setTimeout(r, 0))
          return { id: row.id }
        }),
      },
    }
    try {
      const out = await cb(tx)
      rows.push(...staged) // commit
      return out
    } finally {
      if (heldKey) release() // commit/rollback 시 xact lock 해제
    }
  }) as never)

  return { rows, lockCalls, txCreate }
}

describe('generateMonthlyCuration concurrency (advisory xact lock)', () => {
  const originalKey = process.env.GEMINI_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-key'
    vi.mocked(prisma.product.findMany).mockResolvedValue([PRODUCT] as never)
    vi.mocked(getApprovedCurationEventsForMonth).mockResolvedValue([])
    generateContent.mockImplementation(async () => {
      // 두 호출 모두 사전 count 를 통과한 뒤 쓰기 구간에서 경합하도록 지연
      await new Promise((r) => setTimeout(r, 5))
      return {
        response: {
          text: () =>
            JSON.stringify([
              {
                productId: 'prod-1',
                title: '11월의 다낭',
                subtitle: '건기의 시작, 다낭 해변 산책',
                bodyKr: '선선한 바람.',
                ctaLabel: '보기',
                countryCode: '베트남',
              },
            ]),
        },
      }
    })
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = originalKey
  })

  it('two concurrent overwrite:false runs for same month create rows only once', async () => {
    const db = installFakeDb()
    const [a, b] = await Promise.all([
      generateMonthlyCuration('2026-11', { overwrite: false }),
      generateMonthlyCuration('2026-11', { overwrite: false }),
    ])

    const oks = [a, b].filter((r) => r.ok)
    const exists = [a, b].filter((r) => !r.ok && r.code === 'EXISTS')
    expect(oks).toHaveLength(1)
    expect(exists).toHaveLength(1)
    expect(db.rows).toHaveLength(1)
    expect(db.txCreate).toHaveBeenCalledTimes(1) // 재시도·추가 쓰기 없음
    expect(prisma.monthlyCurationContent.deleteMany).not.toHaveBeenCalled()
    expect(db.lockCalls).toEqual([
      monthlyCurationWriteLockKey('2026-11', 'overseas'),
      monthlyCurationWriteLockKey('2026-11', 'overseas'),
    ])
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
  })

  it('different months do not block or skip each other', async () => {
    const db = installFakeDb()
    const [a, b] = await Promise.all([
      generateMonthlyCuration('2026-11', { overwrite: false }),
      generateMonthlyCuration('2026-12', { overwrite: false }),
    ])
    expect(a.ok && b.ok).toBe(true)
    expect(db.rows.map((r) => r.monthKey).sort()).toEqual(['2026-11', '2026-12'])
  })

  it('lock key is scoped by pageScope and monthKey', () => {
    expect(monthlyCurationWriteLockKey('2026-11', 'overseas')).toBe('monthly_curation_content:overseas:2026-11')
    expect(monthlyCurationWriteLockKey('2026-11', 'overseas')).not.toBe(
      monthlyCurationWriteLockKey('2026-12', 'overseas'),
    )
  })
})
