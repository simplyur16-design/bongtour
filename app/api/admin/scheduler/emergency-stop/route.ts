import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import * as os from 'os'
import { requireAdmin } from '@/lib/require-admin'

/**
 * POST /api/admin/scheduler/emergency-stop. 인증: 관리자.
 */
export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const platform = os.platform()
    const isWin = platform === 'win32'
    let output = ''
    try {
      if (isWin) {
        // Playwright가 사용하는 Chromium 실행 파일명 (Windows)
        const cmd = 'taskkill /F /IM chromium.exe 2>nul & taskkill /F /IM chrome.exe 2>nul & echo done'
        output = execSync(cmd, { encoding: 'utf-8', shell: 'cmd.exe', timeout: 10000 })
      } else {
        const cmd = "pkill -9 -f 'chromium|chrome.*automation|playwright' 2>/dev/null || true"
        output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 })
      }
    } catch (e) {
      // pkill/taskkill이 매칭되는 프로세스 없으면 비0 종료할 수 있음
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('not found') && !msg.includes('No processes') && msg.indexOf('128') === -1) {
        console.error('emergency-stop:', e)
      }
    }
    return NextResponse.json({
      ok: true,
      message: '비상 정지 신호를 보냈습니다. Playwright/Chromium 프로세스를 종료했습니다.',
      platform,
    })
  } catch (e) {
    console.error('emergency-stop:', e)
    return NextResponse.json(
      { ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
