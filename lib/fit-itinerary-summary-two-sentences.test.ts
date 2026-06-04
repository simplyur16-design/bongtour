import { describe, expect, it } from 'vitest'
import {
  countFitSummarySentences,
  ensureFitDaySummaryTwoSentences,
  ensureFitMasterSummaryTwoSentences,
} from '@/lib/fit-itinerary-summary-two-sentences'
import { parseFitItineraryGeminiJson } from '@/lib/fit-itinerary-gemini-parse'

describe('ensureFitDaySummaryTwoSentences', () => {
  it('이미 2문장이면 유지', () => {
    const s = '도톤보리를 걸으며 오사카 밤거리를 즐겨 보세요. 저녁 이동 전에 교통편을 확인해 두시면 편해요.'
    expect(countFitSummarySentences(ensureFitDaySummaryTwoSentences(s))).toBeGreaterThanOrEqual(2)
  })

  it('1문장이면 2문장째를 붙인다', () => {
    const out = ensureFitDaySummaryTwoSentences('도톤보리 산책을 추천드려요.', {
      landmarkHint: '도톤보리',
    })
    expect(countFitSummarySentences(out)).toBeGreaterThanOrEqual(2)
    expect(out).toContain('도톤보리')
  })
})

describe('parseFitItineraryGeminiJson', () => {
  it('Gemini 1문장 day.summary를 파싱 시 2문장으로 보정', () => {
    const json = JSON.stringify({
      title: '오사카',
      summary: '오사카 자유여행 매력.',
      persona: 'mixed',
      days: [
        {
          dayNumber: 1,
          title: '도착',
          summary: '공항 도착 후 호텔 체크인.',
          dayCityKey: 'osaka',
          activities: [
            {
              order: 1,
              category: 'transport',
              title: '도착',
              description: 'd',
              location: '간사이 공항',
              startTime: '10:00',
              durationMinutes: 60,
              estimatedCostKrw: 0,
              estimatedCostNote: 'n',
              transportMode: '택시',
              transportDuration: '40분',
            },
          ],
        },
      ],
    })
    const parsed = parseFitItineraryGeminiJson(json, 'test')
    expect(countFitSummarySentences(parsed.summary)).toBeGreaterThanOrEqual(2)
    expect(countFitSummarySentences(parsed.days[0]!.summary)).toBeGreaterThanOrEqual(2)
  })
})

describe('ensureFitMasterSummaryTwoSentences', () => {
  it('1문장 master.summary 보정', () => {
    const out = ensureFitMasterSummaryTwoSentences('오사카 매력.')
    expect(countFitSummarySentences(out)).toBeGreaterThanOrEqual(2)
  })
})
