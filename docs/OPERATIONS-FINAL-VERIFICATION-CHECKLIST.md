# 운영 최종 검증 체크리스트 (복붙용)

**목적**: 개발·코드 영역 검증이 끝난 뒤, **운영 환경·실제 세션·브라우저**로만 닫을 수 있는 **남은 3건**을 운영자가 재현·확인할 때 사용한다.  
**전제**: 새 기능 추가 없음. 배포된 앱 URL·DB·시크릿은 각 환경에 맞게 치환한다.

---

## 1) 전체 판정 (이 문서로 “완료”를 말할 수 있는 조건)

아래 **3개 항목 모두**에서 체크박스를 채우면, **운영 최종 검증**은 닫힌 것으로 본다.

| # | 항목 | 완료 조건 |
|---|------|-----------|
| A | 가격 동기화 | 운영 `HQ_PRODUCT_BASE_URL` 설정 후, 테스트 상품에 대해 **`priceFrom`이 스크래핑 결과와 일치하도록 갱신**됨을 확인 (또는 본사 페이지에 가격 패턴이 없어 **의도적으로 미갱신**인 경우, 그 사유를 로그/화면으로 확인) |
| B | 관리자 이미지 API | **관리자로 로그인한 브라우저 세션**에서 `POST /api/admin/convert-to-webp`가 **HTTP 200** 및 응답 본문 `ok: true` (또는 `download=1` 시 WebP 바이너리) |
| C | 카카오 상담 CTA | 상품 상세에서 CTA **1회** 클릭 → 채널/채팅 연결·복사 UX가 기대대로 동작 (선택: GTM/GA4는 [GTM-KAKAO-COUNSEL-GA4.md](./GTM-KAKAO-COUNSEL-GA4.md) 기준) |

---

## 2) 운영자 최종 체크리스트 (한 장 요약)

```
[ ] A. 가격 동기화 (HQ URL + originCode + supplierGroupId)
    [ ] 배포 환경에 HQ_PRODUCT_BASE_URL = 실제 본사 상품 URL 템플릿 ({code}, {group} 치환 가능)
    [ ] 테스트용 상품: originCode·supplierGroupId 본사와 일치
    [ ] 동기화 실행 전 priceFrom 기록 → 실행 후 비교 (관리자 화면 또는 DB)
    [ ] 실패 시: 콘솔/로그에서 scrape 오류·DNS·차단 여부 확인

[ ] B. 관리자 이미지 API (세션 필수)
    [ ] 운영 도메인에서 카카오(또는 허용된 IdP)로 관리자 계정 로그인 (role: ADMIN)
    [ ] DevTools Network 또는 관리자 UI에서 convert-to-webp 호출 시 200 확인
    [ ] curl만으로는 불가: /api/admin/* 는 미들웨어에서 세션 필수 (401은 정상)

[ ] C. 카카오 상담 CTA (수동 1회)
    [ ] 모바일/데스크톱 각각 또는 대표 1환경에서 상담 버튼 동작
    [ ] (선택) GTM 미리보기 / GA4 DebugView — 상세는 GTM-KAKAO-COUNSEL-GA4.md
```

---

## 3) 가격 동기화 확인 절차 (`priceFrom` 실변화)

### 사전 조건

- 환경 변수 **`HQ_PRODUCT_BASE_URL`**: 본사에서 사용하는 **실제** 상품 상세 URL 패턴.  
  - 플레이스홀더(존재하지 않는 도메인)면 DNS 실패로 동기화 불가.  
  - 템플릿에 **`{code}`**, **`{group}`** 치환이 `lib/scraper` 경로와 맞아야 함 (프로젝트 `.env.example` 참고).
- DB 상품: **`originCode`**(본사 상품 코드), **`supplierGroupId`**(그룹 번호)가 비어 있지 않음.  
  - `scripts/sync-prices.ts`는 **`supplierGroupId`가 있는 상품만** 대상으로 한다.

### 실행

- 서버/작업 환경에서 DB·`HQ_PRODUCT_BASE_URL`이 운영과 동일하게 로드된 상태로:
  - `npm run cron:sync`  
  - 또는 `npx tsx scripts/sync-prices.ts`

### 확인

1. 동기화 **전** 테스트 상품의 `priceFrom` 값을 기록한다 (관리자 상품 상세 또는 DB).
2. 동기화 **후** 동일 상품의 `priceFrom`을 다시 본다.
3. 본사 페이지 HTML에 **한국어 원화 패턴**(예: `1,234,567원` 형태)이 스크래퍼가 읽을 수 있으면 갱신 기대.  
   - 패턴이 없거나 차단되면 값이 그대로일 수 있음 → **로그**(`Updated …` / `Sync failed …`)로 판단.

### 완료 판정

- HQ URL이 실제이고 본사 페이지에 가격이 노출되는 경우: **`priceFrom`이 기대 범위로 변하거나**, 최소한 **스크립트 로그에 해당 `originCode`/`group`에 대한 성공 메시지**가 남는다.

---

## 4) 관리자 이미지 API 확인 절차 (`POST /api/admin/convert-to-webp` → 200)

### 왜 브라우저인가

- Next.js **미들웨어**가 `/api/admin/*`에 대해 **NextAuth 세션(`req.auth`)**을 요구한다.
- `ALLOW_MOCK_ADMIN` 등은 **라우트 내부 `requireAdmin`에만** 해당할 수 있으며, **세션 없이 curl로는 미들웨어 401**이 나는 것이 설계상 정상이다.

### 절차 (권장: 관리자 UI가 해당 API를 호출하는 화면 사용)

1. **운영(또는 스테이징) URL**로 이동한다.
2. **카카오 등으로 관리자 계정**에 로그인한다 (`ADMIN_EMAIL` 등 프로젝트 정책에 맞는 계정, role `ADMIN`).
3. 이미지 업로드·WebP 변환 기능이 붙은 **관리자 화면**에서 파일을 선택해 변환을 실행한다.
4. 브라우저 **개발자 도구 → Network**에서 `convert-to-webp` 요청이 **200**인지, 응답 JSON에 **`ok: true`**(또는 다운로드 모드 시 이미지 응답)인지 확인한다.

### API만 직접 때릴 때 (고급)

- 동일 브라우저에서 로그인 후 **세션 쿠키**를 포함한 `POST`(multipart, 필드명 **`file`**)를 보낸다.  
- 세션 쿠키 없이 호출하면 **401**이 나와야 한다.

### 완료 판정

- 로그인 상태에서 **200 + 정상 본문** 1회 확인.

---

## 5) 카카오 상담 CTA 수동 확인 절차 (1회)

### 필수 (UX)

1. 배포 사이트에서 **임의 상품 상세**로 이동한다.
2. **카카오 상담 / 1:1 상담** 등 CTA를 **1회** 클릭한다.
3. 다음을 확인한다:
   - 카카오 채널 또는 채팅이 **의도한 대상**으로 열리는지  
   - (해당되는 경우) 안내 문구·복사·딥링크가 **깨지지 않는지**

### 선택 (분석)

- GTM·GA4까지 “운영 검증 완료”로 맞출 경우: **[GTM-KAKAO-COUNSEL-GA4.md](./GTM-KAKAO-COUNSEL-GA4.md)** 의 B·C 절차를 따른다.

### 완료 판정

- 위 UX 3항이 문제없으면 **CTA 수동 검증 완료**. 분석은 문서 기준 선택.

---

## 6) 관련 코드·정책 참고 (수정 없음)

| 구분 | 위치 |
|------|------|
| 가격 동기화 스크립트 | `scripts/sync-prices.ts`, `npm run cron:sync` |
| 미들웨어 `/api/admin/*` | `middleware.ts` |
| 이미지 변환 API | `app/api/admin/convert-to-webp/route.ts` |

---

## 7) 남은 TODO (운영자 액션)

- [ ] 운영 시크릿에 **실제 `HQ_PRODUCT_BASE_URL`** 반영 후 A 완료
- [ ] 운영 도메인에서 **관리자 로그인** 후 B 완료
- [ ] **카카오 CTA 1회** 클릭으로 C 완료 (선택: GTM/GA4는 별도 문서)
