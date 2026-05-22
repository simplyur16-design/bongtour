# eSIM QR 카카오 알림톡 (Solapi)

결제·발급 완료 후 `deliverEsimToCustomer` → `sendEsimQrDeliveredAlimTalk` 호출.

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
| `installLink` | USIMSA 설치/다운로드 URL |
| `qrLink` | QR 이미지 URL (없으면 installLink와 동일) |

## 예시 문구 (심사용 참고)

```
[Bong투어] eSIM 설치 안내

주문번호 #{orderNumber}

아래 링크에서 eSIM을 설치해 주세요.
#{installLink}

QR 이미지: #{qrLink}
```

## 수신 번호

- 체크아웃 **휴대폰** 필드 → `bongsim_order.buyer_tel` (선물 주문은 `consents.gift.recipient_phone`)
- 미입력 주문: 회원 `User.phone`(이메일 일치) 폴백
- 알림톡 실패 시 **LMS**로 동일 내용 발송

## 체크아웃

고객은 결제 전 **휴대폰(010…)** 입력이 필수입니다.
