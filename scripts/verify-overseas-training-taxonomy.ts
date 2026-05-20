/**
 * npx tsx scripts/verify-overseas-training-taxonomy.ts
 */
import { LISTING_KIND_VALUES } from '@/lib/product-listing-kind'
import {
  TRAINING_AUDIENCE_VALUES,
  TRAINING_CATEGORY_VALUES,
  trainingAudienceMatchesFilter,
} from '@/lib/overseas-training-taxonomy'
import { formatTrainingDepartureWeekdayLabel, formatTrainingProgramMetaLine } from '@/lib/overseas-training-weekday'
import {
  listTrainingDepartureYmdInRange,
  trainingScheduleDayYmd,
} from '@/lib/overseas-training-departure-calendar'

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error('[FAIL]', msg)
    process.exit(1)
  }
}

assert(LISTING_KIND_VALUES.includes('overseas_training'), 'listingKind overseas_training')
assert(TRAINING_CATEGORY_VALUES.length === 8, '8 categories')
assert(TRAINING_AUDIENCE_VALUES.length === 3, '3 audiences')
assert(formatTrainingDepartureWeekdayLabel(2) === '화요일 출발', 'weekday label')
assert(!formatTrainingDepartureWeekdayLabel(2)?.includes('매년'), 'no yearly phrase')
assert(formatTrainingProgramMetaLine(9, 2) === '9일 프로그램 · 화요일 출발', 'meta line')
assert(trainingAudienceMatchesFilter('both', 'public'), 'both matches public')
assert(!trainingAudienceMatchesFilter('corporate', 'public'), 'corporate not public')

const juneRange = { startYmd: '2026-06-01', endYmd: '2026-06-30' }
const mondays = listTrainingDepartureYmdInRange(1, juneRange)
assert(
  mondays.join(',') === '2026-06-01,2026-06-08,2026-06-15,2026-06-22,2026-06-29',
  'June 2026 Monday departures'
)
assert(trainingScheduleDayYmd('2026-06-01', 2) === '2026-06-02', 'day2 from Jun 1 Mon dep')
assert(trainingScheduleDayYmd('2026-06-08', 2) === '2026-06-09', 'day2 from Jun 8 Mon dep')

console.log('[OK] verify-overseas-training-taxonomy')
