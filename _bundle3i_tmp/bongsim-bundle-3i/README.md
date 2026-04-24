# 봉심 번들 3-I — Toss Payments PG 연동

**목표**: 봉심 `bongsim_mock` provider 옆에 **`toss_payments`** provider를 추가해서
실 PG로 결제를 완결할 수 있게 만든다. 결제 차단 팝업 제거, CheckoutStoreClient가 토스를 호출하도록 변경.

---

## 전체 구성

### 신규 파일 9개

| 파일 | 역할 |
|------|------|
| `lib/bongsim/payments/toss/types.ts` | 토스 API 응답 스키마 |
| `lib/bongsim/payments/toss/client.ts` | 서버 측 토스 API 호출 (confirm·cancel·retrieve) |
| `lib/bongsim/payments/toss/webhook-parser.ts` | 웹훅 파싱 + 조회 검증 (double-check) |
| `lib/bongsim/payments/providers/toss-payments.ts` | 세션 생성 어댑터 |
| `lib/bongsim/data/process-toss-payment-outcome.ts` | DB finalize (attempt/order/outbox) |
| `app/api/bongsim/payments/toss/confirm/route.ts` | 결제 승인 API |
| `app/api/bongsim/webhooks/payments/toss/route.ts` | 웹훅 수신 |
| `app/travel/esim/checkout/payment/toss/page.tsx` | 토스 위젯 결제창 + success 콜백 처리 |
| `env.toss.example` | .env 병합용 참고 |

### 덮어쓰기 2개

| 파일 | 변경 |
|------|------|
| `lib/bongsim/contracts/payment-session.v1.ts` | `client.kind` union에 `"toss_sdk"` 추가 |
| `lib/bongsim/payments/payment-provider-registry.ts` | `toss_payments` 등록 |

### 부분 수정 1개 (str_replace)

| 파일 | 변경 |
|------|------|
| `components/bongsim/checkout-store/CheckoutStoreClient.tsx` | provider 교체 + 결제 차단 팝업 제거 |

---

## 적용 순서 (단계별, 각 단계 후 tsc 검증)

### Step 0 — 토스 SDK 설치

```bash
npm install @tosspayments/tosspayments-sdk
```

### Step 1 — 번들 zip 풀기 + 신규·덮어쓰기 파일 배치

```powershell
if (-not (Test-Path .\bongsim-bundle-3i.zip)) {
  Copy-Item "$env:USERPROFILE\Downloads\bongsim-bundle-3i.zip" .\bongsim-bundle-3i.zip
}
Expand-Archive -Path .\bongsim-bundle-3i.zip -DestinationPath .\_bundle3i_tmp -Force

# 디렉토리 생성
New-Item -ItemType Directory -Force -Path .\lib\bongsim\payments\toss | Out-Null
New-Item -ItemType Directory -Force -Path .\lib\bongsim\payments\providers | Out-Null
New-Item -ItemType Directory -Force -Path .\lib\bongsim\data | Out-Null
New-Item -ItemType Directory -Force -Path .\app\api\bongsim\payments\toss\confirm | Out-Null
New-Item -ItemType Directory -Force -Path .\app\api\bongsim\webhooks\payments\toss | Out-Null
New-Item -ItemType Directory -Force -Path .\app\travel\esim\checkout\payment\toss | Out-Null

# 복사 (Copy-Item -Recurse로 전체 트리 덮어쓰기)
Copy-Item -Recurse -Force .\_bundle3i_tmp\bongsim-bundle-3i\lib\* .\lib\
Copy-Item -Recurse -Force .\_bundle3i_tmp\bongsim-bundle-3i\app\* .\app\

Remove-Item -Recurse -Force .\_bundle3i_tmp
Remove-Item -Force .\bongsim-bundle-3i.zip
```

### Step 2 — `.env.local`에 토스 키 추가

`env.toss.example` 를 참고해서 `.env.local` 끝에 아래 3줄 추가:

```
TOSS_SECRET_KEY=test_sk_…
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_…
```

(웹훅 IP 화이트리스트는 선택사항. 일단 비워둬도 됨)

### Step 3 — CheckoutStoreClient 수정 (str_replace 2곳)

**파일**: `components/bongsim/checkout-store/CheckoutStoreClient.tsx`

#### 3-1) provider 교체

Before:
```tsx
            provider: "bongsim_mock",
```

After:
```tsx
            provider: "toss_payments",
```

#### 3-2) redirect_path 분기 (toss_sdk일 때 amount/orderName/email 추가 파라미터 전달)

Before:
```tsx
        if (pj.schema !== "bongsim.payment_session.response.v1" || !pj.client?.redirect_path) {
          setSubmitError("결제 응답이 올바르지 않습니다.");
          return;
        }
        const path = pj.client.redirect_path.startsWith("/") ? pj.client.redirect_path : `/${pj.client.redirect_path}`;
        router.push(path);
```

After:
```tsx
        if (pj.schema !== "bongsim.payment_session.response.v1" || !pj.client?.redirect_path) {
          setSubmitError("결제 응답이 올바르지 않습니다.");
          return;
        }
        let path = pj.client.redirect_path.startsWith("/") ? pj.client.redirect_path : `/${pj.client.redirect_path}`;
        if (pj.client.kind === "toss_sdk") {
          const extra = new URLSearchParams({
            tossOrderId: pj.client.toss_order_id,
            orderName: pj.client.order_name,
            customerEmail: pj.client.customer_email,
            amount: String(pj.client.amount_krw),
          });
          path += (path.includes("?") ? "&" : "?") + extra.toString();
        }
        router.push(path);
```

#### 3-3) (존재하면) 결제 차단 팝업 제거

이전 세션에서 CheckoutStoreClient에 추가한 `maintenanceOpen` state, 가드 5줄, modal JSX가 있다면 전부 제거.

찾아서 삭제할 패턴 예:
- `const [maintenanceOpen, setMaintenanceOpen] = useState(false);`
- fetch 직전에 `setMaintenanceOpen(true); return;` 같은 가드 블록
- 하단 `{maintenanceOpen ? ( ... 모달 JSX ... ) : null}`

파일 내에서 `maintenanceOpen` 검색 → 관련 라인 모두 제거. 없으면 생략.

### Step 4 — 타입체크 + 빌드

```bash
npx tsc --noEmit
npm run dev
```

### Step 5 — 결제 플로우 테스트 (테스트키로)

1. `/travel/esim/catalog` → 상품 선택 → 체크아웃 진입
2. 이메일·약관 입력 후 **결제 진행**
3. `/travel/esim/checkout/payment/toss?paymentAttemptId=…&orderId=…&tossOrderId=…&orderName=…&amount=…` 로 이동
4. 토스 위젯(카드·간편결제·현금영수증) 렌더링 확인
5. **결제하기** 버튼 클릭 → 토스 결제창 팝업
6. 테스트 카드 `4330-1234-1234-1234` / 유효기간 미래 / CVV 123 / 생년월일 임의 입력
7. 승인 → 자동으로 `/travel/esim/checkout/payment/toss?paymentKey=…&…` 로 복귀
8. 페이지가 "결제 확인 중이에요" 스피너 → confirm API 호출 → `/travel/esim/checkout/return/success`로 redirect
9. DB 확인:
   - `bongsim_payment_attempt.status = 'captured'`
   - `bongsim_order.status = 'paid'`, `payment_reference = 토스 paymentKey`
   - `bongsim_payment_provider_event`에 이벤트 1건
   - `bongsim_outbox`에 `OrderPaid` 레코드

### Step 6 — 웹훅 수동 테스트 (선택)

토스 개발자센터 > 내 상점 > 웹훅 에서 엔드포인트 등록:
```
POST {origin}/api/bongsim/webhooks/payments/toss
```

개발자센터에서 "테스트 웹훅 발송" 버튼으로 확인. 이 엔드포인트는 paymentKey로 토스에 다시
조회해서 검증하므로 가짜 요청은 무시됨.

### Step 7 — 취소 테스트

토스 테스트: 토스 개발자센터 > 결제 취소 테스트, 또는 운영 중엔 관리자 페이지에서
`cancelTossPayment({ paymentKey, cancelReason })` 호출.

(관리자 페이지의 취소 버튼 연동은 별도 작업으로 남겨둠.)

---

## 보안/안전 체크

- ✅ `TOSS_SECRET_KEY`는 서버 라우트에서만 읽음 (`@/lib/bongsim/payments/toss/client`). 브라우저 번들에 노출되지 않음.
- ✅ 결제 금액 검증 3단계: 클라이언트 선언 금액 ↔ 토스 응답 `totalAmount` ↔ DB `grand_total_krw`. 한 곳이라도 어긋나면 `amount_mismatch` 반환.
- ✅ 웹훅 `double-check`: 수신 본문을 믿지 않고 paymentKey로 토스에 재조회해서 검증.
- ✅ 멱등성: `bongsim_payment_provider_event (provider, provider_event_id)` unique index + Idempotency-Key 헤더.
- ⚠️ DB 반영 실패 시 복원: 토스 쪽은 승인됐는데 봉심 DB 반영 실패면 500 반환. 운영자가 수동 reconcile 필요. 이 케이스는 로그에 `db_reconcile_failed` 남김.

---

## 알려진 제약 & 향후 작업

- **부분 취소 미지원**: `cancelTossPayment`는 전액 취소. 부분 환불이 필요해지면 `cancelAmount` 옵션 추가.
- **가상계좌 입금 지연 처리**: 위젯에서 가상계좌 결제는 `WAITING_FOR_DEPOSIT` 상태로 끝남. 실제 입금 시 웹훅으로 `DEPOSIT_CALLBACK`이 오는데, 현재 코드는 이벤트 타입에 관계없이 payment.status를 매핑하므로 자동 처리됨 (DONE으로 바뀌면 captured).
- **브랜드페이/자동결제**: 지원 안 함. 일반결제(NORMAL) 전제.
- **현금영수증 발행 관리**: 토스가 자동 발급. 우리 DB에는 `payment_provider_event.payload_json`에 `cashReceipt` 블록 저장됨. 별도 UI는 없음.
- **관리자 취소 버튼**: 별도 페이지로 추가 필요 (`cancelTossPayment` 호출).

---

## 롤백

Step 1~3이 완료된 상태에서 결제 플로우에 문제 생기면:

1. `components/bongsim/checkout-store/CheckoutStoreClient.tsx`의 provider를 `bongsim_mock`으로 되돌림
2. 빌드 후 dev 재시작
3. mock 결제 플로우로 복귀

신규 파일들은 그대로 두어도 됨 (사용되지 않음).
