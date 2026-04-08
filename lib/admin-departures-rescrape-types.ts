import type { DepartureRescrapeResult } from '@/lib/admin-departure-rescrape'
import type { HanatourPythonDiagnostics, HanatourPythonMonthRun } from '@/lib/hanatour-departures'

export type AdminDeparturesRescrapeStage =
  | 'route'
  | 'collect'
  | 'python'
  | 'parse'
  | 'upsert'
  | 'refresh'
  | 'done'

export type AdminDeparturesRescrapeResponseBody = {
  ok: boolean
  stage: AdminDeparturesRescrapeStage
  message: string
  site: DepartureRescrapeResult['site'] | null
  detailUrl: string | null
  collectorStatus: string | null
  collectedCount: number
  upsertAttemptedCount: number
  upsertedCount: number
  emptyResult: boolean
  pythonTimedOut: boolean
  stderrSummary: string
  stdoutSummary: string
  diagnostics: HanatourPythonDiagnostics | null
  error?: string
  mode?: DepartureRescrapeResult['mode']
  source?: DepartureRescrapeResult['source']
  liveError?: string | null
  mappingStatus?: DepartureRescrapeResult['mappingStatus']
  notes?: string[]
  productId?: string
  clientRefreshExpected?: boolean
  productPriceSyncedCount?: number
  productPriceSyncError?: string | null
  pythonMonthDiagnostics?: HanatourPythonMonthRun[] | null
  hanatourMonthSummaryLines?: string[]
  rescrapeOutcome?: 'success' | 'success_partial' | 'failed' | 'empty'
}
