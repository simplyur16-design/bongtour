# USIMSA API 분석 리포트

**원문(공개 문서):** [Postman Documenter — Usimsa Partner API(v2)](https://documenter.getpostman.com/view/33332387/2sB3QDwt5F)

**수집 방법:** 공개 Postman Documenter HTML(`curl.exe`) 및 동일 문서가 prefetch하는 컬렉션 JSON  
`https://documenter.gw.postman.com/api/collections/33332387/2sB3QDwt5F?segregateAuth=true&versionTag=latest`  
(일부 자동화 fetch 도구는 타임아웃될 수 있으나, 동일 URL은 `curl`로 정상 수집 가능했음.)

---

## 1. API 개요

### Base URL

| 환경 | Base URL (문서 표기) |
|------|----------------------|
| Production | `https://open-api.usimsa.com/api` |
| Development | `https://open-api-dev.usimsa.com/api` |

Postman 예시 요청 URL은 개발 서버 호스트를 사용한다. 프로덕션 연동 시 호스트만 교체하면 되며, 경로는 동일하게 `/api/v2/...` 형태로 보인다.

### 버전

- 문서·컬렉션 명칭: **Partner API (v2)**  
- REST 경로 접두: **`/api/v2/`**

### 인증 방식

- **Access Key + Secret Key** (파트너별 발급, 유효기간·발급 절차는 Usimsa 운영팀 관리).
- **Bearer 토큰 아님.** 모든 보호 API는 아래 **요청 서명 헤더**가 필요하다.

### 서명 방식 (요청마다)

1. **StringToSign** (줄바꿈 `\n`):

   ```text
   {METHOD} {pathAndQuery}
   {timestamp}
   {accessKey}
   ```

   - `METHOD`: 대문자 HTTP 메서드 (`GET`, `POST` 등).
   - `pathAndQuery`: **URL의 path + query string** (문서 예: `GET /api/order?query1=&query2` 전체에서 path+query 부분).
   - `timestamp`: **Epoch 밀리초** 문자열. 헤더 `x-gat-timestamp`와 **반드시 동일**해야 함.

2. Secret Key를 키로 **HMAC-SHA256** → 결과를 **Base64** 인코딩 → `x-gat-signature`.

3. 문서 샘플(C#)에서는 `SecretKey`를 **Base64 디코드한 바이트 배열**로 `HMACSHA256`에 넣는다. JavaScript 샘플은 `CryptoJS.enc.Base64.parse(secretKey)`로 동일 취지.

### 공통 요청 헤더

| 헤더 | 설명 |
|------|------|
| `Content-Type` | `application/json` (Body 사용 시) |
| `x-gat-timestamp` | UTC 기준 경과 밀리초 |
| `x-gat-access-key` | Access Key ID |
| `x-gat-signature` | 위 절차로 생성한 서명 |

---

## 2. 엔드포인트 목록

아래는 Postman 컬렉션에 등록된 **9개** 엔드포인트이다. 소개 문구에는 **환불·정산 데이터 조회** 등이 언급되나, **이 공개 컬렉션에는 해당 API 정의가 없음** — 별도 문서·담당자 확인이 필요하다.

### 2.1 `POST /api/v2/order` — eSIM 발급 요청

| 항목 | 내용 |
|------|------|
| 목적 | 파트너 `orderId`와 옵션별 수량으로 eSIM 발급 요청. 이후 **웹훅**으로 상세( ICCID, LPA 등 ) 수신. |
| Body (예시) | `{ "orderId": string, "products": [ { "optionId": string, "qty": number }, ... ] }` |
| 성공 응답 (예시, HTTP 200) | `{ "products": [ { "topupId", "optionId" }, ... ], "code": "0000", "message": "" }` |
| 에러 코드 | Postman 예시에는 비즈니스 결과 필드 `code` / `message`만 있으며, **`0000` 외 코드 테이블은 공개 문서에 없음**. HTTP 상태코드·본문은 연동 시 로깅으로 확정 필요. |

### 2.2 `POST /api/v2/cancel/:topupId` — eSIM 취소 요청

| 항목 | 내용 |
|------|------|
| 목적 | 지정 `topupId` eSIM 취소. |
| Path | `:topupId` → 실제 Usimsa 주문 번호로 치환. |
| Body | 예시는 빈 Body. |
| 성공 응답 (예시) | `{ "code": "0000", "message": "" }` |

### 2.3 `POST /api/v2/cancel/usim/:topupId` — USIM 취소 요청

| 항목 | 내용 |
|------|------|
| 목적 | USIM 건 취소. |
| 성공 응답 (예시) | `{ "code": "0000", "message": "" }` |

### 2.4 `POST /api/v2/order/usim` — USIM 활성화

| 항목 | 내용 |
|------|------|
| 목적 | USIM 옵션 + ICCID로 활성화(주문). |
| Body (예시) | `{ "orderId", "optionId", "iccid" }` |
| 성공 응답 (예시) | `{ "topupId", "code": "0000", "message": "" }` |

### 2.5 `POST /api/v2/extend` — 연장(Extend)

| 항목 | 내용 |
|------|------|
| 목적 | 기존 충전/상품 연장. |
| Body (예시) | `{ "topupId", "optionId" }` |
| 성공 응답 (예시) | `{ "topupId", "code": "0000", "message": "" }` |

### 2.6 `GET /api/v2/products` — 상품 조회

| 항목 | 내용 |
|------|------|
| 목적 | 판매 가능 옵션 목록 조회. |
| 성공 응답 (예시) | `{ "products": [ { "optionId", "productName", "price", "days", "quota", "qos", "isCancelable" }, ... ], "code", "message" }` |

### 2.7 `GET /api/v2/order/:orderId` — 주문 조회

| 항목 | 내용 |
|------|------|
| 목적 | 파트너가 부여한 `orderId`로 발급된 라인아이템·상태 조회. |
| 성공 응답 (예시) | `products[]`에 `createdAt`, `topupId`, `optionId`, `iccid`, `smdp`, `activateCode`, `downloadLink`, **QR 이미지 URL**, `status`, `expiredDate` 등. 예시 `status` 값: `Canceled`, `Opening`. |
| 필드명 주의 | 예시 응답에는 **`qrCodeImgUrl`** (camelCase). 웹훅 문서 표에는 **`qrcodeImgUrl`** — **실연동 시 필드 별칭/대소문자 불일치 가능성** 있음. |

### 2.8 `GET /api/v2/topup/:topupId` — ICCID/Topup 상태 조회

| 항목 | 내용 |
|------|------|
| 목적 | 단일 topup 메타·사용량 요약. |
| 성공 응답 (예시) | `{ "topup": { "topupId", "createTime", "expireTime", "activeTime", "usage" }, "code", "message" }` |

### 2.9 `GET /api/v2/topup/:topupId/usage/daily` — 일별 사용량 조회

| 항목 | 내용 |
|------|------|
| 목적 | ICCID 기준 일자별 사용량(MB). |
| 성공 응답 (예시) | `{ "usage": { "iccid", "history": [ { "date", "usageMb" } ] }, "code", "message" }` |

---

## 3. 웹훅 스펙

### 이벤트 종류

- 문서상 명시는 **“eSIM API 호출 후 등록된 콜백 URL로 eSIM 정보 전송”** 한 유형으로 읽힌다. (다른 이벤트 타입·`event` 필드는 공개 본문에 없음.)

### 페이로드 구조 (문서 표)

| 필드 | 타입 | 설명 |
|------|------|------|
| `topupId` | String | Usimsa 주문 번호 |
| `optionId` | String | 상품 옵션 ID |
| `iccid` | String | ICCID |
| `smdp` | String | SM-DP+ 주소 |
| `activateCode` | String | 개통 코드 |
| `downloadLink` | String | LPA 형식 다운로드 문자열 (예: `LPA:$usimsa.com$...`) |
| `qrcodeImgUrl` | String | QR 코드 이미지 URL |
| `expiredDate` | String | 만료일자 |

### 서명 검증 (USIMSA → 파트너)

- **공개 문서(본 Postman 문서)에는 웹훅용 HMAC, 공유 시크릿 헤더, 페이로드 서명 등이 정의되어 있지 않음.**
- 신뢰 경계는 **TLS + 콜백 URL 비공개·IP allowlist(가능 시)·멱등 처리** 등으로 보완하고, Usimsa 측에 **별도 서명 규격 여부**를 확인하는 것이 안전하다.

### 재시도 정책

- 문서에는 **“보통 5초 이내 도착, 지연 가능”**만 기술되어 있고, **HTTP 재시도 횟수·간격·멱등 키**는 명시되지 않음.
- 구현 시: **200 빠른 응답**, 본문 검증·DB 반영은 비동기 큐, **동일 `topupId` 중복 전달** 가정한 upsert 권장.

---

## 4. 주요 데이터 모델

### Product (eSIM/USIM 상품 옵션)

- 컬렉션 기준: `optionId`, `productName`, `price`, `days`, `quota`, `qos`, `isCancelable` 등.

### Order (파트너 주문)

- 파트너 생성 `orderId`로 묶음.
- `POST /api/v2/order` 응답의 `products[]`는 `(topupId, optionId)` 쌍으로 발급 라인을 나타냄.

### Topup / eSIM (발급 단위)

- `topupId`: Usimsa 측 주문·충전 단위 식별자.
- `iccid`, `smdp`, `activateCode`, `downloadLink`(LPA), QR URL, `status`, `expiredDate` 등.

### Usage

- `topup.usage` 또는 `usage/history`의 `date` + `usageMb`.

---

## 5. 우리가 구현해야 할 것들

### API 클라이언트 (봉투어 → USIMSA)

- 이미 `lib/usimsa/signature.ts`(StringToSign + HMAC-SHA256 + Base64), `lib/usimsa/client.ts`(`usimsaRequest`), `lib/usimsa/config.ts`, `lib/usimsa/products.ts` 등이 존재한다.
- 위 9개 엔드포인트 중 **미구현 호출**(cancel, extend, usim, topup, usage 등)이 비즈니스에 필요하면 **동일 서명 규칙**으로 메서드별 래퍼 추가.

### 웹훅 수신 (USIMSA → 봉투어)

- `app/api/usimsa/webhook/route.ts`는 현재 **JSON 파싱·로그·200 응답** 수준.
- 필요 작업: **스키마 검증**, `orderId` 매핑(웹훅 본문에 없을 수 있음 → `topupId`로 내부 주문 조인), **QR/LPA 저장**, **Usimsa 서명 규격 확정 시 검증기**, 재전송 대비 **멱등 키**.

### DB 스키마 (제안)

- **외부 상품 캐시:** `option_id`, 가격·일수·쿼터 등 동기화 시각.
- **주문:** 파트너 `order_id`, 상태, 생성 시각.
- **라인/발급:** `topup_id`, `option_id`, `iccid`, `status`, `expired_date`, LPA/QR URL, 원본 웹훅 JSON.
- **사용량 스냅샷(선택):** 일별 usage 히스토리 캐시.

---

## 6. 보안 고려사항

| 항목 | 내용 |
|------|------|
| 서명 검증 | **아웃바운드 API:** 반드시 서버에서만 Secret 사용, 클라이언트 노출 금지(문서 명시). **인바운드 웹훅:** 공개 문서만으로는 서명 검증 불가 → Usimsa 추가 스펙 또는 네트워크 제한 필요. |
| Replay attack | 요청 서명에 **타임스탬프** 포함. 서버에서는 수신 시각과의 skew 허용 범위를 두고 거부하는 패턴이 일반적(문서의 필수는 아니나 권장). |
| 키 관리 | Access/Secret은 환경 변수 또는 비밀 관리자에 저장, 로테이션 절차는 운영팀과 합의. |
| 웹훅 URL | HTTPS, 추측 불가능한 경로, 운영에서 Usimsa에 등록된 URL과 정확히 일치 확인. |

---

## 부록: 문서·데이터 출처

- Postman Documenter: `https://documenter.getpostman.com/view/33332387/2sB3QDwt5F`
- 컬렉션 JSON (문서 페이지가 prefetch):  
  `https://documenter.gw.postman.com/api/collections/33332387/2sB3QDwt5F?segregateAuth=true&versionTag=latest`

본 리포트는 위 공개 자료에 한정되며, **에러 코드 전체 목록·정산/환불 API·웹훅 서명**은 Usimsa 측 추가 자료가 있으면 그에 따른 개정이 필요하다.
