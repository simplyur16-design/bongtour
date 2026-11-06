/**
 * empty7: modetour ortherActions supplierText ??empty7
 */
import { describe, expect, it } from 'vitest'
import { modetourScheduleItemsToFactDays } from '@/lib/register-facts/modetour-register-fact-mappers'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'

describe('modetour empty7 supplierText from ortherActions', () => {
  it('keeps place names and carries itiSummaryDes for description', () => {
    const facts = modetourScheduleItemsToFactDays([
      {
        first: 3,
        placeHeader: ['留덉텛?쎌텛', '?곕（諛ㅻ컮'],
        scheduleHotel: '?덉젙 ?명뀛',
        ortherActions: [
          {
            itiServiceName: '愿愿?,
            itiPlaceName: '留덉텛?쎌텛',
            itiSummaryDes: '?됱뭅 ?좎쟻 留덉텛?쎌텛瑜?諛⑸Ц?⑸땲?? 怨꾨떒??諛?낵 ?쒖뼇?좎쟾??泥쒖쿇???섎윭遊낅땲??',
          },
          {
            itiServiceName: '愿愿?,
            itiPlaceName: '?ㅻ몢留??꾨쭩?',
            itiSummaryDes: '?ㅻ몢留??꾨쭩??먯꽌 怨꾧끝???대젮?ㅻ큶?덈떎.',
          },
        ],
      },
      {
        first: 12,
        placeHeader: [],
        scheduleHotel: '珥?2媛쒖쓽 ?덉젙 ?명뀛???덉뒿?덈떎. ?뺤젙 ?섎뒗?濡??덈궡',
        ortherActions: [],
      },
    ])
    expect(facts[0]?.places.join(' ')).toMatch(/留덉텛?쎌텛/)
    expect(String(facts[0]?.supplierText ?? '')).toMatch(/留덉텛?쎌텛/)
    const sched = modetourFactDaysToRegisterSchedule(facts)
    expect(sched[0]?.description).toMatch(/留덉텛?쎌텛|?됱뭅|?꾨쭩/)
    expect(sched[1]?.title).toMatch(/?덉젙 ?명뀛|?뺤젙/)
  })
})
