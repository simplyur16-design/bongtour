/**
 * 사진 출처 멈춤(stoppedUntil) 영구 저장 — Pexels 가 실제 한도(403·429·남은 한도 0)를 알리면 재배포·재시작 뒤에도
 * 그 시각까지 부르지 않고 다음 허용 출처(Unsplash → Pixabay → Openverse, R03-06/17)로 바로 넘어간다.
 * REGRESSION-FREEZE[pexels-stop-persist-1128]: stoppedUntil 을 기존 ScraperSupplierState 행(키 photo-stock:pexels)에 저장·시작 때 읽어 복원 — 스키마·env 변경 없음 — manifest
 *
 * 저장 위치(스키마 변경 없음): 기존 표 ScraperSupplierState(키-값 꼴: supplierKey 가 기본키, 시각 두 칸).
 *   supplierKey = 'photo-stock:pexels', lastStartedAt = 멈춤을 기록한 시각, lastFinishedAt = stoppedUntil(이 시각까지 호출 금지).
 *   그 표는 키로만 읽고 쓴다(findUnique/upsert) — 다른 공급사 행과 섞이지 않는다.
 * 실패해도 호출 흐름을 막지 않는다(저장·복원 실패 = 지금까지처럼 프로세스 메모리 기준).
 */
export const PEXELS_STOP_STATE_KEY = 'photo-stock:pexels'
/** 다른 프로세스(web·worker)가 기록한 멈춤을 이만큼 간격으로 다시 읽는다 */
export const STOCK_STOP_REHYDRATE_TTL_MS = 60 * 1000
const STORE_TIMEOUT_MS = 3000

export type StockStopStore = {
  /** 저장된 stoppedUntil(ms). 없으면 null */
  load: () => Promise<number | null>
  /** stoppedUntil 을 올리기만 한다(저장된 값보다 작으면 그대로 둔다) */
  save: (untilMs: number, recordedAtMs: number) => Promise<void>
}

type StopRowClient = {
  scraperSupplierState: {
    findUnique: (args: { where: { supplierKey: string }; select: { lastFinishedAt: true } }) => Promise<{ lastFinishedAt: Date | null } | null>
    upsert: (args: {
      where: { supplierKey: string }
      update: { lastStartedAt: Date; lastFinishedAt: Date }
      create: { supplierKey: string; lastStartedAt: Date; lastFinishedAt: Date }
    }) => Promise<unknown>
  }
}

export function prismaStockStopStore(prisma: StopRowClient, key: string = PEXELS_STOP_STATE_KEY): StockStopStore {
  return {
    load: async () => {
      const row = await prisma.scraperSupplierState.findUnique({ where: { supplierKey: key }, select: { lastFinishedAt: true } })
      return row?.lastFinishedAt ? row.lastFinishedAt.getTime() : null
    },
    save: async (untilMs, recordedAtMs) => {
      const prev = await prisma.scraperSupplierState.findUnique({ where: { supplierKey: key }, select: { lastFinishedAt: true } })
      const prevMs = prev?.lastFinishedAt ? prev.lastFinishedAt.getTime() : 0
      const until = new Date(Math.max(untilMs, prevMs))
      const at = new Date(recordedAtMs)
      await prisma.scraperSupplierState.upsert({
        where: { supplierKey: key },
        update: { lastStartedAt: at, lastFinishedAt: until },
        create: { supplierKey: key, lastStartedAt: at, lastFinishedAt: until },
      })
    },
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('stock_stop_store_timeout')), ms)
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    )
  })
}

/** 운영 저장소: 지연 import 한 공용 prisma. DB 가 없으면(빌드·vitest) 던지고, 호출부가 삼킨다. */
export function liveStockStopStore(key: string = PEXELS_STOP_STATE_KEY): StockStopStore {
  const client = async () => (await import('@/lib/prisma')).prisma as unknown as StopRowClient
  return {
    load: async () => withTimeout(client().then((c) => prismaStockStopStore(c, key).load()), STORE_TIMEOUT_MS),
    save: async (u, r) => withTimeout(client().then((c) => prismaStockStopStore(c, key).save(u, r)), STORE_TIMEOUT_MS),
  }
}

export type StopHydratable = { hydrateStoppedUntil: (untilMs: number) => void }

const hy = globalThis as unknown as { __btStopHydratedAt?: Record<string, number>; __btStopSaves?: Set<Promise<void>> }

/**
 * 저장된 멈춤을 메모리 가드에 복원한다. 프로세스(또는 TTL)당 한 번만 읽는다. 실패하면 조용히 넘어간다(막지 않음).
 * 반환: 복원된 stoppedUntil(ms) 또는 null.
 */
export async function hydrateStopFromStore(
  guard: StopHydratable,
  store: StockStopStore,
  opts: { key?: string; now?: () => number; ttlMs?: number; force?: boolean } = {},
): Promise<number | null> {
  const key = opts.key ?? PEXELS_STOP_STATE_KEY
  const now = (opts.now ?? Date.now)()
  const at = (hy.__btStopHydratedAt ??= {})
  if (!opts.force && at[key] != null && now - at[key]! < (opts.ttlMs ?? STOCK_STOP_REHYDRATE_TTL_MS)) return null
  at[key] = now
  try {
    const until = await store.load()
    if (until != null && until > now) {
      guard.hydrateStoppedUntil(until)
      return until
    }
  } catch {
    /* 읽기 실패 — 프로세스 메모리 기준으로 계속 */
  }
  return null
}

/** 멈춤을 저장한다(기다리지 않는 쓰기). 실패는 삼킨다. 테스트는 반환 promise 를 기다린다. */
export function persistStop(store: StockStopStore, untilMs: number, nowMs: number): Promise<void> {
  const p = store.save(untilMs, nowMs).catch(() => {})
  const set = (hy.__btStopSaves ??= new Set())
  set.add(p)
  void p.finally(() => set.delete(p))
  return p
}

export function __resetStopHydrationForTest(): void {
  hy.__btStopHydratedAt = {}
  hy.__btStopSaves = new Set()
}
