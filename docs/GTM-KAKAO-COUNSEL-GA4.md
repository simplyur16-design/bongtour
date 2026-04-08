# GTM / GA4 — `kakao_counsel_click` 실제 수집 검증 절차서

앱은 `pushKakaoCounselDataLayer()`로 `dataLayer`에 이벤트를 넣는다 (`lib/kakao-counsel.ts`).  
**이 문서는 Google 계정으로 GTM·GA4에 로그인한 운영자가**, 배포된 사이트에서 **실제 수집까지** 확인할 때 따라 할 단계를 정리한 것이다.

---

## 1) 전체 판정 기준 — “완료”로 볼 수 있는 조건

아래 **모두** 충족하면 `kakao_counsel_click` GTM/GA4 연동 검증은 **완료**로 본다.

| # | 조건 |
|---|------|
| A | GTM 컨테이너에 **Custom Event 트리거**·**DLV 4개**·**GA4 이벤트 태그**가 구성되어 있고 **게시**됨 |
| B | **Tag Assistant(GTM 미리보기)**에서 CTA 클릭 시 `kakao_counsel_click`이 잡히고, **GA4 이벤트 태그가 성공(Succeeded)** 으로 발화함 |
| C | **GA4 DebugView**(또는 아래 “대안”)에서 이벤트명 `kakao_counsel_click`이 보이고, **매개변수 4개**(`intent`, `product_id`, `origin_source`, `from_screen`)에 값이 있음 |

> **참고**: 코드·로컬 콘솔에서 `dataLayer`만 확인한 상태는 “앱 측 완료”. **운영 검증 완료**는 B·C까지다.

---

## 2) 사전 확인 — `dataLayer` 계약 (SSOT)

CTA(1:1 카카오 상담) 클릭 시 **한 번** 아래 형태로 푸시된다.

| 키 | 의미 |
|----|------|
| `event` | 항상 `kakao_counsel_click` |
| `intent` | `booking` \| `departure` \| `benefit` \| `schedule` |
| `product_id` | 상품 ID (문자열) |
| `origin_source` | 공급사/출처 표시명 |
| `from_screen` | 화면 식별자 (예: `product_detail_desktop`) |

GTM **Data Layer Variable Name**은 위 키와 **대소문자까지 동일**해야 한다.

---

## 3) GTM 웹에서 해야 할 설정 (단계별)

**전제**: GTM에 로그인 → 해당 **웹 컨테이너**(예: `NEXT_PUBLIC_GTM_ID`와 동일 ID) 선택.

### 3-1. GA4 측정 ID 확인

- GA4 관리자 → **데이터 스트림** → 웹 스트림 → **측정 ID** (`G-XXXXXXXXXX`) 확인.
- GTM에 **Google 태그(GTAG / GA4 Configuration)** 가 이미 있으면 그 **측정 ID**를 사용하면 된다.
- **없으면** 먼저 태그 → 새로 만들기 → **Google 태그** 또는 **GA4 구성** 태그를 추가하고 측정 ID를 넣어 저장(트리거: **All Pages**). 이 태그를 아래에서 “GA4 구성 태그”로 선택한다.

### 3-2. Custom Event 트리거 생성

1. 왼쪽 **트리거** → **새로 만들기**
2. 트리거 이름: 예) `CE - kakao_counsel_click`
3. 트리거 구성: **맞춤 이벤트** (Custom Event)
4. 이벤트 이름: `kakao_counsel_click`  
   - 일치 조건: **같음** (Equals)
5. 이 트리거 발생 시기: **모든 맞춤 이벤트**가 아니라 위 이름만 해당되도록 설정(기본 Custom Event는 이벤트 이름만 넣으면 됨)
6. **저장**

### 3-3. Data Layer Variable 4개 생성

각각 **별도 변수**로 만든다. (변수 → 새로 만들기)

| 순서 | 변수 이름 (예시, 자유) | 변수 유형 | Data Layer Variable Name |
|------|-------------------------|------------|---------------------------|
| 1 | `dlv - kakao intent` | 데이터 레이어 변수 | `intent` |
| 2 | `dlv - kakao product_id` | 데이터 레이어 변수 | `product_id` |
| 3 | `dlv - kakao origin_source` | 데이터 레이어 변수 | `origin_source` |
| 4 | `dlv - kakao from_screen` | 데이터 레이어 변수 | `from_screen` |

**설정 시 주의**

- **Data Layer Variable Name** 칸에는 **따옴표 없이** `intent` 처럼만 입력.
- **데이터 레이어 버전**: **버전 2** 권장.
- 기본값(optional): 비워 둬도 됨. 비어 있으면 태그에서 `undefined`로 갈 수 있으므로, 검증 시 “값이 안 비었는지”를 본다.

### 3-4. GA4 이벤트 태그 생성

1. **태그** → **새로 만들기**
2. 태그 이름: 예) `GA4 - kakao_counsel_click`
3. 태그 구성: **Google 애널리틱스: GA4 이벤트** (Google Analytics: GA4 Event)
4. **측정 ID** 또는 **구성 태그**: 기존 **GA4 구성 태그** 선택 (3-1에서 만든 것)
5. **이벤트 이름**: `kakao_counsel_click`
6. **이벤트 매개변수** → 행 추가:

| 매개변수 이름 | 값 |
|---------------|-----|
| `intent` | `{{dlv - kakao intent}}` (위에서 만든 변수명과 **정확히** 일치) |
| `product_id` | `{{dlv - kakao product_id}}` |
| `origin_source` | `{{dlv - kakao origin_source}}` |
| `from_screen` | `{{dlv - kakao from_screen}}` |

7. **트리거**: `CE - kakao_counsel_click` 선택
8. **저장**

### 3-5. 게시(Publish)

1. 오른쪽 상단 **제출** (Submit)
2. **버전 이름**·**버전 설명** 입력 (예: `kakao_counsel_click GA4 이벤트 추가`)
3. **게시**

> **성공 기준(이 단계)**: 게시 완료 후 최신 **버전**에 위 태그·트리거·변수가 포함됨.

---

## 4) Tag Assistant(GTM 미리보기) 확인 절차 (단계별)

GTM의 **미리보기**는 브라우저에 **Tag Assistant** 창을 띄워, `dataLayer` 이벤트와 태그 발화를 보여 준다.

### 4-1. 미리보기 연결

1. GTM 웹 → 오른쪽 상단 **미리보기** 클릭
2. **웹사이트 URL**에 검증할 주소 입력  
   - 예: `https://실제도메인.com` 또는 로컬 `http://localhost:3000` (로컬은 GTM·사이트가 같이 떠 있어야 함)
3. **연결** → 새 탭에서 사이트가 열리면 연결됨

### 4-2. CTA 클릭 전

- Tag Assistant 하단 **Summary**에 `Container Loaded`, `DOM Ready` 등이 보이는지 확인 → **GTM 스니펫이 사이트에 붙어 있는지** 1차 확인.

### 4-3. 카카오 상담 CTA 클릭

1. 상품 상세 등에서 **「1:1 카카오 상담하기」** 클릭
2. Tag Assistant **Summary** 패널을 연다.

### 4-4. 반드시 확인할 것

| 확인 항목 | 어디서 보는지 | 성공 기준 |
|-----------|----------------|-----------|
| `kakao_counsel_click` 이벤트 발생 | Summary 왼쪽 이벤트 목록 또는 타임라인 | **Custom Event** 또는 `kakao_counsel_click` 이름의 이벤트가 **새로 추가**됨 |
| Data Layer에 4개 키 | 해당 이벤트 선택 → **Data Layer** 탭 | `intent`, `product_id`, `origin_source`, `from_screen`이 **모두 있고 값이 비어 있지 않음** (빈 문자열이면 앱/상황 확인) |
| GA4 이벤트 태그 발화 | 같은 이벤트 선택 → **Tags Fired** (또는 Output) | `GA4 - kakao_counsel_click` 태그가 **Fired** 또는 **성공** |
| 태그 오류 | **Tags Not Fired** 또는 메시지 영역 | GA4 태그가 **실패/차단**이면 트리거·변수·구성 태그 확인 |

### 4-5. Data Layer Variables가 GTM 변수로 비어 보일 때

- 이벤트를 클릭한 뒤 **Variables** 탭에서 `dlv - kakao intent` 등이 **해당 이벤트 시점**에 채워졌는지 본다.
- **같은 이벤트 객체**에 키가 있어야 DLV가 채워진다. (이전 페이지뷰의 변수만 보면 안 됨)

> **성공 기준(Tag Assistant)**: `kakao_counsel_click` 1회당 GA4 이벤트 태그 **1회 성공 발화** + DLV 4개 **비어 있지 않음**.

---

## 5) GA4 DebugView 확인 절차 (단계별)

DebugView는 **디버그 신호가 있는 히트**를 우선 보여 준다. 웹에서는 보통 **Chrome 확장**으로 디버그 모드를 켠다.

### 5-1. 디버그 모드 켜기 (권장)

1. Chrome에 **[Google Analytics Debugger](https://chrome.google.com/webstore)** (또는 GA4 공식 안내의 디버거) 설치
2. 확장 **켜기**(ON)
3. 검증할 사이트 탭에서 **페이지 새로고침** 후 CTA 클릭

### 5-2. GA4에서 DebugView 열기

1. [analytics.google.com](https://analytics.google.com) → 해당 **속성**
2. 왼쪽 하단 **관리(톱니)** → **디버그뷰** (또는 **보고서** 메뉴 근처 **구성 → DebugView**)
3. **기기 선택** 드롭다운에서 본인 브라우저/기기가 보이는지 확인

### 5-3. 반드시 확인할 것

| 확인 항목 | 성공 기준 |
|-----------|-----------|
| 이벤트명 | 목록에 **`kakao_counsel_click`** 이 나타남 |
| 매개변수 | 이벤트 클릭 → **매개변수**에 아래 4개가 있고 값이 있음 |
| | `intent` |
| | `product_id` |
| | `origin_source` |
| | `from_screen` |

### 5-4. DebugView에 아무것도 안 보일 때 (대안)

- **보고서 → 실시간(Realtime)** 에서 **이벤트 이름**으로 `kakao_counsel_click` 카운트가 오르는지 확인.  
  - 실시간은 디버그 없이도 올라갈 수 있어 **1차 수집 확인**용으로 유용하다.
- 단, **매개변수 상세**는 DebugView 또는 **BigQuery/탐색**에서 추가 확인하는 편이 낫다.

> **성공 기준(DebugView)**: 디버그 기기에서 `kakao_counsel_click` + 위 4개 매개변수 **값 존재**.

---

## 6) GA4 보고서에서 차원으로 쓰려면 (선택)

DebugView/실시간에 파라미터가 보여도, **탐색/표준 보고서**에서 차원으로 쓰려면:

- GA4 **관리자** → **데이터 표시** → **맞춤 정의** → **맞춤 차원 만들기**
- 범위: **이벤트**, 이벤트 매개변수 이름: `intent`, `product_id`, `origin_source`, `from_screen` 각각 등록

(등록 전이라도 **검증 목적**의 DebugView 확인에는 지장 없음.)

---

## 7) 실패 시 원인 분류표

| 증상 | 원인 후보 | 조치 |
|------|-----------|------|
| **브라우저 콘솔 `dataLayer`에는 있는데 GTM 미리보기에 이벤트가 안 보임** | 다른 탭/도메인에서 클릭함 · 미리보기 미연결 · **컨테이너 ID 불일치**(사이트 GTM ID ≠ 편집 중인 컨테이너) · 광고 차단기가 GTM 차단 | 같은 탭에서 미리보기 연결 후 재시도 · `NEXT_PUBLIC_GTM_ID`와 GTM 웹 상단 컨테이너 ID 일치 확인 · 차단기 끄기 |
| **GTM에서는 이벤트가 보이는데 GA4에 안 감** | GA4 이벤트 태그 **미게시** · **잘못된 측정 ID** · 구성 태그가 해당 페이지에서 안 뜸 · **내부 트래픽 필터** 등 GA4 필터 · Adblock이 `google-analytics.com` 차단 | 최신 버전 게시 확인 · GA4 구성 태그의 측정 ID가 실제 속성과 일치하는지 · Tag Assistant에서 GA4 요청 **성공** 여부 · 실시간 보고서로 교차 확인 |
| **GA4에 이벤트는 오는데 파라미터가 비어 있음** | DLV 이름 오타 (`intent` vs `Intent`) · 매개변수 매핑에 **다른 변수** 선택 · 푸시 직후 **다른 이벤트**의 변수만 읽음 | GTM 변수 **Data Layer Variable Name** 4개를 코드와 동일하게 수정 · GA4 태그 매개변수에 DLV 4개 재연결 |
| **운영 사이트에서 GTM 자체가 안 붙음** | 배포 환경에 **`NEXT_PUBLIC_GTM_ID` 미설정** · 오타 · **프로덕션 빌드 캐시**로 예전 HTML · CSP가 `googletagmanager.com` 차단 | 호스팅 환경 변수 확인 후 재배포 · 페이지 소스에서 `googletagmanager.com/gtm.js?id=` 검색 |
| **미리보기에서만 되고 라이브에서 안 됨** | **게시 안 함** · 라이브는 다른 GTM 컨테이너/버전 | 제출 → **게시** · 라이브 URL로 Tag Assistant(미리보기) 재연결 |

---

## 8) 운영 점검표 (복붙용)

아래 표를 복사해 Notion/시트에 붙여 넣고 기록하면 된다.

```markdown
| 날짜 | 환경 (local/staging/prod) | 사이트 URL | GTM 컨테이너 ID | GTM 게시 버전/메모 |
|------|---------------------------|------------|-----------------|---------------------|
| YYYY-MM-DD | | | GTM-XXXX | |

| 항목 | 예/아니오 | 메모 |
|------|-----------|------|
| Tag Assistant에서 `kakao_counsel_click` 이벤트 발생 | | |
| GA4 이벤트 태그 발화 성공 | | |
| DLV: intent 비어 있지 않음 | | |
| DLV: product_id 비어 있지 않음 | | |
| DLV: origin_source 비어 있지 않음 | | |
| DLV: from_screen 비어 있지 않음 | | |
| GA4 DebugView에서 이벤트명 확인 | | |
| GA4에서 intent 파라미터 확인 | | |
| GA4에서 product_id 파라미터 확인 | | |
| GA4에서 origin_source 파라미터 확인 | | |
| GA4에서 from_screen 파라미터 확인 | | |
| 이상 여부 (없음/있음) | | |
| 조치 내용 | | |

검증자: _____________
```

---

## 9) 관련 코드

- `lib/kakao-counsel.ts` — `pushKakaoCounselDataLayer`
- `app/components/GoogleTagManager.tsx` — `NEXT_PUBLIC_GTM_ID` 시 GTM 스니펫 로드
- `docs/KAKAO-COUNSEL-ROADMAP.md` — 제품 로드맵

---

## 10) 수정 파일 목록 (문서)

| 파일 | 설명 |
|------|------|
| `docs/GTM-KAKAO-COUNSEL-GA4.md` | 본 문서 — GTM 설정·Tag Assistant·GA4 DebugView·실패 분류·점검표 |
