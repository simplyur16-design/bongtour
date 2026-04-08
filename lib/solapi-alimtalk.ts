import { SolapiMessageService } from 'solapi'
import { generateSmartLink } from '@/lib/link-builder'

const sdk = new SolapiMessageService(
  process.env.SOLAPI_KEY!,
  process.env.SOLAPI_SECRET!
)

export type AlimtalkCustomerData = {
  phone: string
  agency: string
  code: string
  title: string
  date: string
  composition: string
  totalKrw: string | number
  totalForeign: string
  productId: string
}

export async function sendAlimtalkWithDetail(customerData: AlimtalkCustomerData) {
  const {
    phone,
    agency,
    code,
    title,
    date,
    composition,
    totalKrw,
    totalForeign,
    productId,
  } = customerData

  const message = {
    to: phone,
    from: process.env.SOLAPI_SENDER!,
    type: 'ATA' as const,
    templateId: 'BONGTOUR_QUOTATION_01',
    text: `[Bong투어] ${agency}/${code}/${title}\n- 날짜: ${date}\n- 인원: ${composition}\n- 견적: ${totalKrw}+${totalForeign}`,
    buttons: [
      {
        buttonName: '상세 일정 및 현지 사진 보기',
        buttonType: 'WL' as const,
        linkMo: generateSmartLink(productId),
        linkPc: generateSmartLink(productId),
      },
      {
        buttonName: '사장님과 직접 상담하기',
        buttonType: 'AL' as const,
        linkMo: 'kakaoplus://plusfriend/friend/@봉투어',
      },
    ],
  }

  return await sdk.sendOne(message)
}
