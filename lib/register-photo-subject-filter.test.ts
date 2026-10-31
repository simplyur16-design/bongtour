import { describe, expect, it } from 'vitest'
import { photoCandidateText, photoSubjectBlockReason, itineraryMentionsAnimal, photoSourceMetadataFlag } from '@/lib/register-photo-subject-filter'

const ctx = (destinationEn: string, productText = '', query = destinationEn) => ({ destinationEn, productText, query })

describe('register-photo-subject-filter (문과장 1차 검수 교체 사례)', () => {
  it('비행기·손목시계 = 무관 사물', () => {
    expect(photoSubjectBlockReason('airplane flying over mountains', ctx('Da Nang'))).toBe('unrelated_object')
    expect(photoSubjectBlockReason(photoCandidateText(['https://www.pexels.com/photo/close-up-of-a-wristwatch-123/']), ctx('Guilin', '', 'Li River'))).toBe('unrelated_object')
    expect(photoSubjectBlockReason(photoCandidateText(['다낭_Da_Nang_Airport_pexels__mp8p148w.webp']), ctx('Da Nang'))).toBe('unrelated_object')
  })
  it('얼굴·간판은 탈락 사유 아님(사장님 10/31 09:58)', () => {
    expect(photoSubjectBlockReason('traditional dancer in costume in manado', ctx('Manado'))).toBeNull()
    expect(photoSubjectBlockReason('neon signs in dotonbori osaka', ctx('Osaka', '오사카 도톤보리'))).toBeNull()
    expect(photoSubjectBlockReason('temple gate with wooden plaque', ctx('Seoul'))).toBeNull()
  })
  it('출처 미상은 메타 표시만', () => {
    expect(photoSourceMetadataFlag({ photographer: null, sourceUrl: '' })).toBe('source_unknown')
    expect(photoSourceMetadataFlag({ photographer: 'Jane', sourceUrl: null })).toBeNull()
  })
  it('복도·서점 실내 = 장소 사진 아님', () => {
    expect(photoSubjectBlockReason('empty hallway', ctx('Taipei'))).toBe('interior_not_place')
    expect(photoSubjectBlockReason('starfield library bookshelves', ctx('Seoul'))).toBe('interior_not_place')
  })
  it('일정에 없는 동물은 탈락, 일정에 있으면 허용 (호도협 지명 속 tiger 는 동물 아님)', () => {
    expect(photoSubjectBlockReason('tiger resting on grass', ctx('Lijiang', '여강 호도협 트레킹 Tiger Leaping Gorge', 'Tiger Leaping'))).toBe('animal_not_in_itinerary')
    expect(photoSubjectBlockReason('elephant in pattaya', ctx('Pattaya', '파타야 · 코끼리 트래킹', 'Elephant Trekking'))).toBeNull()
    expect(itineraryMentionsAnimal('호도협 tiger leaping gorge', 'tiger')).toBe(false)
  })
  it('다른 도시 사진(베니스≠런던, 오사카≠후쿠오카)', () => {
    expect(photoSubjectBlockReason('gondola on canal in venice', ctx('London', '런던 파리'))).toBe('city_mismatch')
    expect(photoSubjectBlockReason('osaka castle park', ctx('Fukuoka', '후쿠오카'))).toBe('city_mismatch')
    expect(photoSubjectBlockReason('dotonbori neon signs at night', ctx('Fukuoka', '후쿠오카'))).toBe('city_mismatch')
    expect(photoSubjectBlockReason('osaka castle park', ctx('Osaka', '오사카'))).toBeNull()
  })
  it('약한 일치: 설명에 장소 단어가 없으면 requirePlaceMatch 에서 탈락, 있으면 통과', () => {
    expect(photoSubjectBlockReason('sunset over calm water', ctx('Almaty', '', 'Kolsai Lakes'), { requirePlaceMatch: true })).toBe('no_place_relevance')
    expect(photoSubjectBlockReason('kolsai lakes in kazakhstan', ctx('Almaty', '', 'Kolsai Lakes'), { requirePlaceMatch: true })).toBeNull()
    expect(photoSubjectBlockReason('', ctx('Almaty', '', 'Kolsai Lakes'), { requirePlaceMatch: true })).toBeNull()
  })
  it('정상 장소 사진은 통과', () => {
    expect(photoSubjectBlockReason('himeji castle among trees', ctx('Himeji', '히메지성'))).toBeNull()
    expect(photoSubjectBlockReason('marina bay sands skyline singapore', ctx('Singapore'), { requirePlaceMatch: true })).toBeNull()
  })
})
