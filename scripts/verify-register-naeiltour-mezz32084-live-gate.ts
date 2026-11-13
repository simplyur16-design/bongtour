/**
 * 내일투어 MEZZ32084 — 신규 등록 SSOT full parse live gate.
 * 포함/불포함·옵션·쇼핑·항공·잔여좌석·일정(routeText a-g·description)·imageKeyword 슬롯.
 *
 * 판정 2단계: ① 수집(view.asp·tab0·tab1·출발 목록)이 재시도 후에도 timeout·연결실패·5xx·429면 SKIP(종료코드 78)
 * ② 수집 정상인데 값이 틀리면 FAIL. 4xx·판매불가도 FAIL. 확인 항목은 녹화 fixture 테스트와 같은
 * `assertNaeiltourMezz32084RegisterParsed` (assertScheduleImageKeywordSlots 포함).
 *
 * REGRESSION-FREEZE[naeiltour-register-mezz32084-live-gate]: manifest
 * npx tsx scripts/verify-register-naeiltour-mezz32084-live-gate.ts
 */
import { parseNaeiltourRegisterFromApi } from '@/lib/naeiltour-register-api-parse'
import { fetchNaeiltourRegisterDetailBundleResult } from '@/lib/naeiltour-register-api-detail'
import {
  assertNaeiltourMezz32084RegisterParsed,
  NAEILTOUR_MEZZ32084_URL,
} from '@/lib/naeiltour-mezz32084-gate-assertions'
import {
  classifyLiveGateFetchErrors,
  LIVE_GATE_EXTERNAL_SKIP_EXIT_CODE,
  reportLiveGateExternalSkip,
} from '@/lib/regression-freeze/live-gate-external'
import { isSupplierFetchError } from '@/lib/supplier-http/supplier-fetch'

const URL = NAEILTOUR_MEZZ32084_URL
const SUPPLIER = 'naeiltour'
const GATE = 'mezz32084'

function skipAndExit(verdict: ReturnType<typeof classifyLiveGateFetchErrors>): never {
  if (verdict.verdict !== 'skip') throw new Error('skipAndExit requires skip verdict')
  reportLiveGateExternalSkip(verdict.reasons)
  console.warn(`\nSKIPPED: naeiltour MEZZ32084 live gate (external outage, exit ${LIVE_GATE_EXTERNAL_SKIP_EXIT_CODE})`)
  process.exit(LIVE_GATE_EXTERNAL_SKIP_EXIT_CODE)
}

async function main() {
  console.log('=== verify-register-naeiltour-mezz32084-live-gate ===\n')

  // ① 수집 단계 — 같은 실행 안에서 parse가 이 묶음을 그대로 공유한다 (추가 요청 없음).
  const detail = await fetchNaeiltourRegisterDetailBundleResult(URL)
  if (detail.outcome === 'unsellable' || detail.outcome === 'invalid_url') {
    throw new Error(`MEZZ32084 detail ${detail.outcome} — 상품 교체 필요 (FAIL)`)
  }
  const fetchVerdict = classifyLiveGateFetchErrors(SUPPLIER, GATE, detail.fetchErrors)
  if (fetchVerdict.verdict === 'fail') throw new Error(`MEZZ32084 fetch failed (FAIL): ${fetchVerdict.message}`)
  if (fetchVerdict.verdict === 'skip') skipAndExit(fetchVerdict)

  let parsed: Awaited<ReturnType<typeof parseNaeiltourRegisterFromApi>>
  try {
    parsed = await parseNaeiltourRegisterFromApi('', 'naeiltour', { originUrl: URL })
  } catch (e) {
    if (isSupplierFetchError(e)) {
      const f = e.failure
      const v = classifyLiveGateFetchErrors(SUPPLIER, GATE, [
        { part: f.part, url: f.url, errorKind: f.errorKind, attempts: f.attempts.length, elapsedMs: f.elapsedMs },
      ])
      if (v.verdict === 'skip') skipAndExit(v)
    }
    throw e
  }

  // ② 값 확인 — 수집 정상인데 틀리면 FAIL.
  assertNaeiltourMezz32084RegisterParsed(parsed)

  const schedule = parsed.schedule ?? []
  console.log('[ok] title:', parsed.title?.slice(0, 80))
  console.log('[ok] schedule days:', schedule.length)
  console.log('[ok] day1 route:', schedule[0]?.routeText)
  console.log('[ok] day1 kw:', schedule[0]?.imageKeyword)
  console.log('\nPASSED: naeiltour MEZZ32084 live gate')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
