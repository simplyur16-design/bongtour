import { describe, expect, it } from 'vitest'
import {
  extractWindsorPrepSectionsFromText,
  findWindsorPrepBlockStart,
  splitWindsorPasteForTraining,
} from '@/lib/overseas-training-windsor-sections'

describe('overseas-training-windsor-sections', () => {
  it('findWindsorPrepBlockStart — 해외여행 안전정보 앞을 상품 본문으로', () => {
    const paste = `프라하 연수 프로그램 소개입니다.\n대상: 공무원\n\n\t해외여행 안전정보\n외교부 안내 문구입니다.\n\n\t예약시 유의사항\n♠ 최소출발인원\n10명 이상`
    expect(findWindsorPrepBlockStart(paste)).toBeGreaterThan(10)
    const split = splitWindsorPasteForTraining(paste)
    expect(split.programBody).toContain('프라하 연수')
    expect(split.programBody).not.toContain('외교부 안내')
    expect(split.prepSections.length).toBeGreaterThanOrEqual(2)
    expect(split.prepSections[0]!.title).toBe('해외여행 안전정보')
  })

  it('extractWindsorPrepSectionsFromText — ♠ 단위로 items 분리', () => {
    const tail = `예약시 유의사항\n♠ 항공 관련\n이코노미 기준입니다.\n♠ 수하물\n23kg 1개`
    const sections = extractWindsorPrepSectionsFromText(tail)
    expect(sections).toHaveLength(1)
    expect(sections[0]!.title).toBe('예약시 유의사항')
    expect(sections[0]!.items.length).toBeGreaterThanOrEqual(2)
  })
})
