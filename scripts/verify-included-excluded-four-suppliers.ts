/**
 * 공급사별 포함/불포함 결정적 파서 스모크(LLM 없음).
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import { parseHanatourIncludedExcludedStructured } from '@/lib/hanatour-basic-info-body-extract'
import { parseModetourIncludedExcludedSection } from '@/lib/modetour-basic-info-must-know-extract'
import { parseVerygoodtourIncludedExcludedSection } from '@/lib/register-verygoodtour-basic'
import { parseYbtourIncludedExcludedSection } from '@/lib/register-ybtour-basic'

function main() {
  const yb = parseYbtourIncludedExcludedSection(`포함사항
· 교통 : 왕복
· 여행자보험 : 가입

불포함사항
· 개인 여행경비
· 각종 매너팁

▷ 호텔 써차지(성수기)
2026.01.01 100원
2026.01.02 200원
2026.01.03 300원
2026.01.04 400원
2026.01.05 500원
2026.01.06 600원
2026.01.07 700원
2026.01.08 800원
예 ) 무시할 예시
미팅장소 안내`)
  console.log(
    'YB inc',
    yb.includedItems.length,
    'exc',
    yb.excludedItems.length,
    'note',
    yb.noteText?.slice(0, 60)
  )
  const incJoined = yb.includedItems.join('\n')
  if (/써차지|E-비자|갈라디너/i.test(incJoined)) throw new Error('YB_FAIL surcharge in included')

  const vg = parseVerygoodtourIncludedExcludedSection(`미팅장소보기 링크
O 포함사항   O 불포함사항
1. 왕복항공요금 및 제세 공과금
2. 유류할증료
3. 일정 상 표기된 식사 및 관광지 입장료
4. 호텔 숙박료 (2인 1실 기준)
5. 기사/가이드 경비
6. 해외 여행자 보험
1. 개인 경비
상품평점 이후 노이즈`)
  console.log('VG inc', vg.includedItems.length, 'exc', vg.excludedItems.length)
  if (vg.includedItems.length !== 6 || vg.excludedItems.length < 1) throw new Error('VG_FAIL')
  if (vg.includedItems.some((x) => /미팅|상품평점/.test(x))) throw new Error('VG_FAIL noise')

  const md = parseModetourIncludedExcludedSection(`포함/불포함 사항
포함 사항
1. 국제선 왕복 항공료
2. 유류할증료(매월변동), 인천공항세, 제세금 포함
3. 호텔

불포함 사항
1. 1인당 90EUR 가이드
2. 개인 경비

예약 시 유의 사항
여기는 제외`)
  console.log('MD inc', md.includedItems.length, 'exc', md.excludedItems.length)
  if (!md.includedItems.some((x) => /제세금\s*포함|항공료/.test(x))) throw new Error('MD_FAIL inc')
  if (!md.excludedItems.some((x) => /EUR|개인/.test(x))) throw new Error('MD_FAIL exc')
  if (md.excludedItems.some((x) => /예약\s*시\s*유의/.test(x))) throw new Error('MD_FAIL notice')

  const ha = parseHanatourIncludedExcludedStructured(
    `앞부분 노이즈
포함/불포함/선택경비 정보
포함내역
[교통]
왕복항공권

불포함내역
식사비

선택경비
비자 발급비

선택관광/기항지관광/현지투어에 관한 상세 내역은 패키지 상품상세를 참고바랍니다.
상품약관`,
    null
  )
  console.log('HA inc', ha.includedItems.length, 'exc', ha.excludedItems.length)
  const ex = ha.excludedItems.join('\n')
  if (!/식사|비자|발급/.test(ex)) throw new Error('HA_FAIL merge selection')
  if (ha.includedItems.some((x) => /선택관광|약관/.test(x))) throw new Error('HA_FAIL tail')

  console.log('VERIFY_OK included-excluded four suppliers')
}

main()
