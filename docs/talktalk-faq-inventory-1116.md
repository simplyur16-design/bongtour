# 톡톡 FAQ 문의 종류 조사 (2026-11-16)

고객에게 보이는 문의 종류만 모았습니다. 호텔만 단독 접수 화면은 없습니다.

| 문의 종류 | 화면 경로 | 근거 파일 |
|---|---|---|
| 패키지·해외여행상품 | `/travel/overseas`, 헤더, 홈 4카드 | `app/components/Header.tsx`, `lib/main-hub-copy.ts` |
| 상담 신청 | `/inquiry?type=travel` | `app/components/Header.tsx`, `lib/inquiry-page.ts` |
| 자유여행(항공+호텔) | `/travel/air-hotel` | `app/travel/air-hotel/page.tsx`, `app/components/home/AirHotelProductGridClient.tsx` |
| 항공만 | `/air-ticketing` | `app/air-ticketing/page.tsx`, `lib/air-ticketing-content.ts` |
| 호텔만 | 별도 경로 없음. 홈은 항공과 호텔을 함께 안내 | `app/components/home/AirHotelProductGridClient.tsx` |
| 우리끼리 | `/travel/overseas/private-trip` | `lib/main-hub-copy.ts` |
| 공공·기업·국외연수 | `/business`, `/training` | `app/business/page.tsx`, `app/components/training/TrainingHub.tsx` |
| 연수기관 섭외 | `/inquiry?type=institution` | `lib/inquiry-page.ts` |
| 전세버스 | `/charter-bus`, `/inquiry?type=bus` | `app/charter-bus/page.tsx`, `app/components/charter-bus/CharterBusLanding.tsx` |
| eSIM | `/travel/esim`, 환불 `/travel/esim/policy` | `app/components/Header.tsx`, `app/travel/esim/policy/page.tsx` |
| 고객지원·약관 | `/support`, `/terms` | `lib/support-content.ts`, `app/terms/page.tsx` |

문의 폼 유형은 `travel` `institution` `training` `bus` 네 가지입니다. 근거는 `lib/inquiry-page.ts`.

## 공식 FAQ BDT002 요지 (조회 2026-11-16)

고객 답에 옮긴 문장입니다. 값은 다시 조회하지 않았습니다.

- Wi-Fi 신호를 확인하세요. 보안되지 않은 네트워크 같은 보안 경고가 있는 Wi-Fi에서는 등록이 되지 않을 수 있고, 핫스팟으로 등록하는 것도 되지 않을 수 있습니다.
- 설정 > 셀룰러 > eSIM 추가(또는 셀룰러 요금제 추가) > QR 코드 사용 > 세부사항 직접 입력에서 SM-DP 주소와 활성화 코드를 붙여 넣습니다. 확인코드는 비웁니다. 붙여 넣을 때 공백을 지웁니다.
- 설정 > 연결 > SIM 관리자 > eSIM 추가 > 활성화 코드 입력입니다. 붙여 넣을 때 공백을 지웁니다.
- 아이폰은 설정 > 일반 > 전송 또는 iPhone 재설정 > 재설정 > 네트워크 설정 재설정입니다. 안드로이드는 설정 > 일반 > 초기화 > 네트워크 설정 초기화입니다. 저장된 Wi-Fi 정보가 지워질 수 있습니다. 그래도 안 되면 고객센터로 문의합니다.
- 지금 안 함을 누릅니다.
- 설정 > 셀룰러 > 셀룰러 요금제 추가 또는 eSIM 추가에서 QR을 스캔하거나 직접 입력합니다. 기기마다 메뉴 이름이 다를 수 있고, 설치에는 데이터나 Wi-Fi가 필요합니다.
- 설정 > 연결 > SIM 카드 관리자 > 모바일 요금제 추가 또는 eSIM 추가에서 QR을 스캔하거나 개통 코드를 입력합니다. 기기마다 메뉴 이름이 다를 수 있고, 설치에는 데이터나 Wi-Fi가 필요합니다.
- eSIM 데이터 로밍을 켭니다. 현지 통신사 직접 상품은 로밍을 꺼야 할 수 있으니 상품 안내를 따릅니다.
- 비행기 모드를 켰다가 끕니다.
- 아이폰은 설정 > 셀룰러 > 셀룰러 데이터 옵션 > 셀룰러 데이터 네트워크입니다. 안드로이드는 설정 > 연결 > 모바일 네트워크 > 액세스 포인트 이름 > eSIM > 추가입니다. APN 값은 국가·상품마다 다르므로 상품 안내 또는 고객센터에서 확인합니다.
- 상품에 따라 미리 설치할 수 있는 것과 없는 것이 있습니다. 미리 설치가 안 되는 상품은 설치하는 순간 개통되어 일수가 줄어들 수 있으니 설치 전에 상품 안내를 확인합니다.
- 현지 통신사 상품을 국내에서 미리 설치하면 아이폰은 활성화 중 또는 eSIM 활성화에 실패, 안드로이드는 알 수 없음 또는 현재 사업자에서는 서비스가 지원되지 않습니다가 나올 수 있습니다. 이 표시는 정상일 수 있고 현지에서 사용할 수 있습니다.
- 데이터 전용이며 현지 번호는 없습니다. 일부 상품은 예외일 수 있습니다. 보이스톡·페이스타임처럼 데이터로 하는 통화는 가능합니다. 듀얼심으로 한국 번호를 쓰고 받는 것은 가능하지만, 가입 통신사 로밍 요금이 나올 수 있어 그 정책은 통신사에 확인합니다.
- 기본적으로 됩니다. 현지 통신사 정책과 트래픽에 따라 미리 알리지 않고 제한될 수 있습니다.
- 아이폰은 설정 > 셀룰러 > 로밍 데이터 사용량입니다. 안드로이드는 설정 > 연결 > 데이터 사용 > 모바일 데이터 사용량입니다. 일부 상품은 남은 양을 볼 수 없습니다.
- 아이폰은 설정 > 셀룰러 > 해당 eSIM > eSIM 제거입니다. 안드로이드는 설정 > 연결 > SIM카드 관리자 > 해당 eSIM > 삭제입니다. QR은 한 번만 쓸 수 있고 지우면 다시 설치하지 못하는 경우가 많으니, 쓰는 동안에는 지우지 않습니다.
