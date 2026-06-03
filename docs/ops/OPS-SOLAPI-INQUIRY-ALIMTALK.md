# 상담신청 고객 알림톡 (솔라피 4종)

운영자가 등록·제공한 **4개 템플릿만** 사용합니다. `SOLAPI_TPL_TRAVEL_CONSULT` / 「여행상담」 전용 템플릿은 **없습니다**.

## env ↔ 문의 유형

| env | 문의 (`inquiryType` / 폼) | 변수 (`#{…}`) |
|-----|---------------------------|----------------|
| `SOLAPI_TPL_BUS` | `bus_quote` · `/inquiry?type=bus` | 고객명, 이용일, 출발지, 도착지, 인원수 |
| `SOLAPI_TPL_TRAINING` | `overseas_training_quote` · `type=training` | 고객명, 연수지, 인원수, 서비스범위 |
| `SOLAPI_TPL_INSTITUTION` | `institution_request` · `type=institution` | 고객명, 기관명, 희망국가도시, 인원수, 통역희망 |
| `SOLAPI_TPL_PRIVATE_QUOTE` | `travel_consult` + `quoteKind=private_custom` (우리견적) | 고객명, 여행지, 인원수, 출발희망 |

공통: `SOLAPI_PFID`, `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_FROM_PHONE`

## 일반 여행 상담 (`travel_consult`, `/inquiry?type=travel`)

- DB·관리자 알림: 기존과 동일 (`CustomerInquiry`, `/admin/bookings` 통합 목록).
- **고객 카카오 알림톡: 없음** → 발송 시도 없음, 필요 시 **LMS 폴백**만.
- 헤더 「상담 신청」이 이 경로입니다. 솔라피 4종과 별개입니다.

## 패키지 예약

- `SOLAPI_TPL_BOOKING_REQUEST_RECEIVED` — `POST /api/bookings` 전용 (상담신청 4종과 분리).

## 코드 SSOT

`lib/inquiry-customer-alimtalk.ts` — `resolveInquiryCustomerAlimtalkKind`

## STAFF 답변

- `SOLAPI_TPL_INQUIRY_STAFF_REPLY` — 관리자 답변용 (접수 4종과 별도).
