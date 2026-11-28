/**
 * 자동 사진 회차 상태 기록 — 회차 ID·시작/종료 시각·단계별 stopReason 을 DB 에서 SELECT 로 볼 수 있게 한다.
 * (auto-photo-attempt 로그는 console 전용이라 Railway 로그 없이는 회차를 확인할 수 없었다.)
 * REGRESSION-FREEZE[photo-run-budget-judge-1129]: 기존 ScraperSupplierState 행(스키마·env 변경 없음)에 회차·단계 시각 기록, 실패해도 작업을 막지 않음 — manifest
 *
 * 저장 위치(스키마 변경 없음): ScraperSupplierState(supplierKey 기본키, lastStartedAt, lastFinishedAt).
 *   'photo-autofill:run'                      회차 행. lastStartedAt = 회차 시작(= 회차 ID, epoch ms), lastFinishedAt = 종료(끝나기 전·비정상 종료면 NULL).
 *   'photo-autofill:stage:<단계>:<stopReason>' 단계 행. 같은 키는 다음 회차에 덮어쓴다(키 수 상한: 단계 8 × 사유 6).
 *                                              lastStartedAt/lastFinishedAt = 그 단계가 그 사유로 마지막에 돈 시각.
 * 확인 SELECT:
 *   select "supplierKey","lastStartedAt","lastFinishedAt" from "ScraperSupplierState"
 *    where "supplierKey" like 'photo-autofill:%' order by "lastFinishedAt" desc nulls first;
 * 회차 ID 는 'photo-autofill:run' 의 lastStartedAt 에 해당하는 epoch ms 이며, 단계 행은 그 시각 이후 시각으로 연결된다.
 * ID·시각·사유만 저장한다(키·URL·개인정보 없음).
 */
export const PHOTO_RUN_STATE_KEY = 'photo-autofill:run'
export const PHOTO_RUN_STAGE_KEY_PREFIX = 'photo-autofill:stage:'
const STORE_TIMEOUT_MS = 3000

export type PhotoRunStage =
  | 'site-health'
  | 'public-wrong'
  | 'pending-wrong'
  | 'pending-wrong-continued'
  | 'fill'
  | 'nightly'
  | 'public-wrong-continued'

export type RunStateStore = {
  /** 키 하나를 시작·종료 시각으로 덮어쓴다(없으면 만든다). finishedAt 이 null 이면 종료 칸을 비운다. */
  save: (key: string, startedAt: Date, finishedAt: Date | null) => Promise<void>
}

type StateClient = {
  scraperSupplierState: {
    upsert: (args: {
      where: { supplierKey: string }
      update: { lastStartedAt: Date; lastFinishedAt: Date | null }
      create: { supplierKey: string; lastStartedAt: Date; lastFinishedAt: Date | null }
    }) => Promise<unknown>
  }
}

export function photoRunStageKey(stage: PhotoRunStage, stopReason: string): string {
  const reason = String(stopReason || 'unknown').replace(/[^a-z0-9_]/gi, '_').slice(0, 40)
  return `${PHOTO_RUN_STAGE_KEY_PREFIX}${stage}:${reason}`
}

export function prismaRunStateStore(prisma: StateClient): RunStateStore {
  return {
    save: async (key, startedAt, finishedAt) => {
      await prisma.scraperSupplierState.upsert({
        where: { supplierKey: key },
        update: { lastStartedAt: startedAt, lastFinishedAt: finishedAt },
        create: { supplierKey: key, lastStartedAt: startedAt, lastFinishedAt: finishedAt },
      })
    },
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('photo_run_state_timeout')), ms)
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    )
  })
}

/** 운영 저장소: 지연 import 한 공용 prisma. DB 가 없으면(빌드·vitest) 던지고 기록기가 삼킨다. */
export function liveRunStateStore(): RunStateStore {
  return {
    save: (key, s, f) =>
      withTimeout(
        import('@/lib/prisma').then((m) => prismaRunStateStore(m.prisma as unknown as StateClient).save(key, s, f)),
        STORE_TIMEOUT_MS,
      ),
  }
}

export type PhotoRunRecorder = {
  /** 회차 ID(= 시작 epoch ms, 문자열) */
  runId: string
  start: () => Promise<void>
  stage: (stage: PhotoRunStage, stopReason: string, stageStartedAtMs: number) => Promise<void>
  finish: () => Promise<void>
}

/** 저장 실패는 모두 삼킨다(기록 때문에 사진 작업이 멈추면 안 된다). */
export function createPhotoRunRecorder(store: RunStateStore, now: () => number = Date.now): PhotoRunRecorder {
  const startedAtMs = now()
  const safe = async (key: string, s: number, f: number | null) => {
    try {
      await store.save(key, new Date(s), f == null ? null : new Date(f))
    } catch {
      /* 기록 실패 — 작업은 계속 */
    }
  }
  return {
    runId: String(startedAtMs),
    start: () => safe(PHOTO_RUN_STATE_KEY, startedAtMs, null),
    stage: (stage, stopReason, stageStartedAtMs) => safe(photoRunStageKey(stage, stopReason), stageStartedAtMs, now()),
    finish: () => safe(PHOTO_RUN_STATE_KEY, startedAtMs, now()),
  }
}
