# Solapi 카카오 알림톡 — 쿠폰·마케팅 (PHASE J)

서버 코드: `lib/notifications/kakao-dispatch.ts`, `lib/notifications/kakao-templates.ts`, `lib/notifications/coupon-notifications.ts`.

## 환경 변수

| 키 | 설명 |
|----|------|
| `SOLAPI_API_KEY` / `SOLAPI_API_SECRET` / `SOLAPI_FROM_PHONE` | 기존 Solapi 발송 자격 (문의 알림톡과 동일) |
| `SOLAPI_KAKAO_DRY_RUN` | 정확히 `false`일 때만 실발송. 미설정·`true`·빈값 등은 **DRY_RUN**(로그만) |
| `SOLAPI_KAKAO_PFID` | 쿠폰용 카카오 채널 PF ID. 비우면 `SOLAPI_PFID` 폴백 |
| `SOLAPI_KAKAO_TPL_COUPON_*` | 비즈센터 승인 템플릿 ID 5종 (`.env.example` 참고) |

로컬은 `.env.local`, Railway·서버는 대시보드에서 위 키를 추가한다. `railway.json`에는 시크릿을 넣지 않는다.

## 운영 인수인계 (사람 작업)

1. 카카오 비즈센터 알림톡 채널 생성·검증 (이미 있으면 생략).
2. 아래 5개 템플릿을 비즈센터에 등록·승인 (영업일 1~3일 소요 가능).
3. 승인된 `templateId`를 Railway(또는 서버 `.env.production`)에 반영.
4. `SOLAPI_KAKAO_PFID`에 해당 채널 ID 기입 (문의와 동일 채널이면 비워 두고 `SOLAPI_PFID`만 사용 가능).
5. PG 심사 등 준비 완료 후 `SOLAPI_KAKAO_DRY_RUN=false`로 실발송 전환.

## 트리거 ↔ 헬퍼 (`lib/notifications/coupon-notifications.ts`)

기존 프롬프트에서 **LMS 발송**으로 적혀 있던 자리는 아래 헬퍼 호출로 통일한다.

| 단계 | 헬퍼 |
|------|------|
| G-1 가입 보너스 | `notifyCouponWelcome(user, userCoupon)` |
| G-2 추천 가입자 | `notifyCouponReferralInvitee(user, userCoupon, inviter)` |
| G-3 리뷰 보상 | `notifyCouponReviewReward(user, userCoupon)` |
| D-5 추천인 지연 발급 | `notifyCouponReferralInviter(inviter, userCoupon, invitee)` |
| H-2 만료 임박 cron | `notifyCouponExpiry(user, userCoupon)` |

저장소에 해당 트리거 라우트/cron이 추가되면 위 표 위치에서 `await` 호출하면 된다.

## 검증

```bash
npm run test:kakao-dispatch
```

`SOLAPI_KAKAO_DRY_RUN=true`일 때 콘솔에 `[kakao-dry-run]` JSON이 5줄 출력되면 정상이다.
