# eSIM QR 카카오 알림톡 (Solapi)

결제·발급 완료 후 `deliverEsimToCustomer` → `bongsim_outbox` topic `EsimQrNotify` enqueue →
순차 드레인(`ESIM_QR_NOTIFY_GAP_MS`, 기본 1200ms) → `sendEsimQrDeliveredAlimTalk` (+ LMS 폴백).

단체 일괄처럼 웹훅이 몰려도 Solapi를 동시에 때리지 않는다. 실패 시 outbox 초 단위 백오프 재시도(최대 5회).

## 환경 변수

| 변수 | 설명 |
|------|------|
| `SOLAPI_API_KEY` / `SOLAPI_API_SECRET` / `SOLAPI_FROM_PHONE` | 기존 Solapi 자격 |
| `SOLAPI_PFID` 또는 `SOLAPI_KAKAO_PFID` | 카카오 채널 PF ID |
| `SOLAPI_TPL_ESIM_QR_DELIVERED` | **필수(실발송)** — 비즈센터 승인 템플릿 ID |

## 템플릿 변수 (솔라피·카카오 등록명과 동일해야 함)

| 변수 | 내용 |
|------|------|
| `orderNumber` | 주문번호 (예: BS-20260522-…) |
| `installPath` | **주문 완료 경로** (도메인 제외, 예: `/travel/esim/order/{uuid}/complete?read_key=…`) |
| `installLink` | (선택) 절대 URL — 구 템플릿 호환용, 코드에서 함께 전송 |
| `qrLink` | (선택) 절대 URL — 구 템플릿 호환용 |

승인 템플릿이 `https://bongtour.com#{installPath}` 형태이면 **`installPath`만** 치환된다. `installLink`만 등록된 템플릿이면 비즈센터 변수명을 맞출 것.

## 예시 문구 (심사용 참고)

```
[Bong투어] eSIM 설치 안내

주문번호 #{orderNumber}

아래 링크에서 QR 코드를 스캔해 eSIM을 설치해 주세요.
https://bongtour.com#{installPath}
```

## 기기 구분 (iPhone / Galaxy)

- 알림톡·LMS는 **기기 구분 없이** 주문 완료 페이지만 보냅니다. (휴대폰 번호만으로는 OS를 알 수 없음)
- **원클릭 설치 URL**은 주문 페이지·이메일에 **iPhone + Galaxy/Android 둘 다** 노출합니다.
  - iPhone: `esimsetup.apple.com/...`
  - Android: `esimsetup.android.com/...`
- QR 스캔은 양쪽 공통입니다.

## 수신 번호

- 체크아웃 **휴대폰** 필드 → `bongsim_order.buyer_tel` (선물 주문은 `consents.gift.recipient_phone`)
- 미입력 주문: 회원 `User.phone`(이메일 일치) 폴백
- 알림톡 실패 시 **LMS**로 동일 내용 발송

## 체크아웃

고객은 결제 전 **휴대폰(010…)** 입력이 필수입니다.
