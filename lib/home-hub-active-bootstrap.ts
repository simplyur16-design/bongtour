import fs from 'fs'
import path from 'path'
import { fetchHomeHubActiveConfigRecord } from '@/lib/home-hub-active-db'

/**
 * 서버 부트 시 1회 실행: DB에 저장된 home-hub 설정을 파일로 복원.
 *
 * 호출 지점: `instrumentation.ts` (Next.js `experimental.instrumentationHook`).
 *
 * 동작:
 *   1) DB에 row 있으면 → public/data/home-hub-active.json 덮어쓰기.
 *   2) DB에 row 없으면 (최초 배포 직후) → no-op, 기존 git 커밋 JSON 유지.
 *
 * 이걸로 Railway 배포 후에도 관리자가 저장한 타일 URL이 복원된다.
 * 파일 쓰기 실패는 로그만 남김 (서버 부팅 중단 금지).
 */

const CONFIG_REL = ['public', 'data', 'home-hub-active.json'] as const

function configPath(): string {
  return path.join(process.cwd(), ...CONFIG_REL)
}

export async function bootstrapHomeHubActiveFromDb(): Promise<void> {
  try {
    const row = await fetchHomeHubActiveConfigRecord()
    if (!row || !row.data) {
      console.info('[home-hub-bootstrap] DB empty — skipping file restore (using git committed JSON).')
      return
    }

    const p = configPath()
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const serialized = JSON.stringify(row.data, null, 2)
    fs.writeFileSync(p, serialized, 'utf8')
    console.info(`[home-hub-bootstrap] restored from DB (updatedAt=${row.updatedAt.toISOString()}).`)
  } catch (e) {
    console.error('[home-hub-bootstrap] failed (non-fatal):', e)
  }
}
