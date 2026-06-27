import { describe, expect, it } from 'vitest'
import { resolveHanatourRegisterDestination } from '@/lib/hanatour-register-destination-from-paste'
import { resolveModetourRegisterDestination } from '@/lib/modetour-register-destination-from-paste'
import { resolveYbtourRegisterDestination } from '@/lib/ybtour-register-destination-from-paste'
import { resolveVerygoodtourRegisterDestination } from '@/lib/verygoodtour-register-destination-from-paste'
import { resolveLottetourRegisterDestination } from '@/lib/lottetour-register-destination-from-paste'

const MODETOUR_SNIPPET = `
[게릴라특가][품격/노쇼핑/VIP버스] 미동부 캐나다10일 <힐튼나이아가라20층이상폭포뷰/올드퀘벡숙박/뉴욕/워싱턴/몬트리올>
여행도시

뉴욕, 나이아가라, 퀘벡, 레이크조지, 필라델피아, 킹스턴, 워싱턴, 몬트리올, 토론토, 요크

예약인원
`

const YBTOUR_SNIPPET = `
미남부, 서부 10일 #4대국립공원 #화이트샌드
방문도시	
인천로스엔젤레스리버사이드(1)투산(1)사구아로툼스톤엘파소(1)화이트샌드갤럽모뉴먼트벨리엔텔로프페이지(1)그랜드캐년라스베가스(1)로스엔젤레스인천
여행 주요일정
`

const HANATOUR_SNIPPET = `
미서부 일주 10일 # VIP 리무진 버스
여행도시	로스앤젤레스(1)-샌디에이고-로스앤젤레스(1)-바스토-라스베이거스(1)-자이언 캐년-브라이스 캐년-페이지(1)
예약 : 6명
`

const VERYGOOD_SNIPPET = `
[VIP 리무진 버스 탑승/실시간항공] 미서부/미동부/캐나다 완전일주 19일
요약설명
■ 미서부 5대캐년 & 조슈아 국립공원/ 나이아가라 폭포
여행여정
인천-로스앤젤레스 - 파소블레스 -샌프란시스코 - 요세미티 - 라스베가스 - 5대캐년
`

describe('supplier register destination from paste', () => {
  it('modetour: 여행도시 목록 + 제목 권역', () => {
    const r = resolveModetourRegisterDestination({
      pastedBody: MODETOUR_SNIPPET,
      title: '[게릴라특가] 미동부 캐나다10일',
      llmDestination: '힐튼나이아가라20층이상폭포뷰',
    })
    expect(r.destinationRaw).toMatch(/뉴욕/)
    expect(r.destinationRaw).toMatch(/토론토/)
    expect(r.destination).toMatch(/미동부|캐나다/)
    expect(r.destination).toMatch(/뉴욕/)
    expect(r.destination).not.toMatch(/폭포뷰|숙박/)
  })

  it('ybtour: 방문도시 경로 파싱', () => {
    const r = resolveYbtourRegisterDestination({
      pastedBody: YBTOUR_SNIPPET,
      title: '미남부, 서부 10일 #4대국립공원',
      llmDestination: '화이트샌드',
    })
    expect(r.destinationRaw).toMatch(/로스/)
    expect(r.destination).toMatch(/미남부|미서부|서부/)
    expect(r.destination).not.toMatch(/화이트샌드/)
  })

  it('hanatour: 여행도시 하이픈 경로', () => {
    const r = resolveHanatourRegisterDestination({
      pastedBody: HANATOUR_SNIPPET,
      title: '미서부 일주 10일',
      llmDestination: 'VIP 리무진',
    })
    expect(r.destinationRaw).toMatch(/로스앤젤레스/)
    expect(r.destination).toMatch(/미서부/)
    expect(r.destination).toMatch(/로스앤젤레스|샌디에이고/)
  })

  it('hanatour: URL-only — title slash cities, not full product title', () => {
    const r = resolveHanatourRegisterDestination({
      pastedBody: '',
      title: '홍콩/마카오 3일',
    })
    expect(r.destination).toMatch(/홍콩/)
    expect(r.destination).not.toMatch(/3일|베스트/)
    expect(r.destinationRaw).toMatch(/홍콩/)
    expect(r.destinationRaw).toMatch(/마카오/)
  })

  it('modetour: URL-only — bracket region from title', () => {
    const r = resolveModetourRegisterDestination({
      pastedBody: '',
      title: '[다낭] #바나힐 #호이안 3박 4일',
    })
    expect(r.destination).toMatch(/다낭/)
    expect(r.destination).not.toMatch(/바나힐|3박/)
  })

  it('verygoodtour: 여행여정 + LLM 특전 거부', () => {
    const r = resolveVerygoodtourRegisterDestination({
      pastedBody: VERYGOOD_SNIPPET,
      title: '미서부/미동부/캐나다 완전일주 19일',
      llmDestination: '세도나캐년숙박',
    })
    expect(r.destinationRaw).toMatch(/로스앤젤레스/)
    expect(r.destination).toMatch(/미서부|미동부|캐나다/)
    expect(r.destination).not.toMatch(/세도나|숙박/)
  })

  it('lottetour: paste 여행일정 tab label must not become destination', () => {
    const r = resolveLottetourRegisterDestination({
      pastedBody: '여행일정 5박 6일',
      title: '[출발확정] 나트랑 5박6일',
    })
    expect(r.destination).toMatch(/나트랑/)
    expect(r.destination).not.toBe('여행일정')
  })
})
