import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatImageKeywordError } from '../lib/image-keyword-error-messages'
import { ScheduleImageKeywordPersistError } from '../lib/schedule-image-keyword-persist'

describe('formatImageKeywordError', () => {
  it('PEXELS_KEYWORD_VIOLATION → 한국어 안내', () => {
    const msg = formatImageKeywordError(
      new ScheduleImageKeywordPersistError(
        '[PEXELS_KEYWORD_VIOLATION] 보조어 패턴 감지: "Budapest Night View" (패턴: "night view").',
      ),
    )
    assert.match(msg, /관광지 영문명만/)
    assert.match(msg, /Night Market은 허용/)
    assert.match(msg, /감지:/)
  })

  it('일반 Error는 메시지 그대로', () => {
    assert.equal(formatImageKeywordError(new Error('네트워크 오류')), '네트워크 오류')
  })
})
