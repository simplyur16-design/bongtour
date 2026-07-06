# Handoff: Simply UR — Install Guide (eSIM 설치 가이드 + FAQ)

## Overview

하단 탭 **Install guide** 화면입니다.  
**구매 전·후 모두** 접근 가능한 **도움말/가이드**이며, simplyur 브랜드 톤으로 eSIM 설치 방법과 FAQ를 제공합니다.

Phase 1 = **한국 eSIM · 외국인 방문객 전용**.  
**USIM(유심) 설치 가이드는 범위 밖** — simplyur는 eSIM만 다룹니다.

## About the Design Files

산출물은 **HTML design reference** (내부 DC 형식)로 제공해도 됩니다.  
개발팀은 React Native(앱) / Next.js(웹)로 **재구현**합니다 — HTML을 그대로 복붙하지 않습니다.

## Fidelity

**High-fidelity.** 색·타이포·간격은 **Login 1b · Plans(04)** handoff와 동일 SSOT.

---

## 1. 전체 화면 순서 (이 화면의 위치)

```
[01 Opening] → [02 Login 1b] → [03 Home]
       ↓
[04 Plans] → [05 Product] → [06 Checkout] (결제 미오픈)
       ↓
[07 Guide]  ★ 이번 디자인 범위 — Install guide 탭
```

**진입 경로**

- 하단 탭 **Install guide** (앱 3탭 중 하나)
- 웹 `/simplyur/{locale}/guide`
- 홈 히어로 링크 `View install guide →`

로그인 **불필요** — Skip·게스트도 읽을 수 있음.

**이번 범위에 넣지 말 것 (별도 handoff 예정)**

| 기능 | 올바른 위치 | 이번 범위 |
|------|-------------|-----------|
| **사용량 조회** | **My eSIM** (구매·로그인 후) | ❌ |
| QR 코드 보기 | My eSIM | ❌ |
| 주문 목록 | My eSIM | ❌ |
| USIM 설치 | 봉심/내국인 — simplyur 아님 | ❌ |
| 호환 기기 전체 목록 | 웹 `/devices` (가이드에서 링크만) | 링크만 |

---

## 2. 화면 목적

**“한국 여행용 eSIM을 어떻게 받고, 설치하고, 한국에서 켜는지 + 자주 묻는 질문.”**

콘텐츠 소스 (운영·카피 정합용, 디자이너 참고):

- iPhone eSIM 설치 영문 가이드 (PDF) → **iPhone 탭** 단계와 맞춤
- Android eSIM 설치 영문 가이드 (PDF) → **Android 탭** 단계와 맞춤
- USIM 설치가이드 (PDF) → **사용하지 않음**

공급사명·내부 코드는 UI에 **노출하지 않음** — simplyur / Bong Tour 고객 문구만.

---

## 3. 프레임·플랫폼

| 항목 | 값 |
|------|-----|
| 우선 타깃 | iPhone 앱, 402×874 logical px (portrait) |
| 웹 | 동일 정보 구조, max-width ~512px |
| 하단 탭 | Home · Find my eSIM · **Install guide** (3탭 유지) |
| 배경 | `#FFF4EF` (Opening / Login 1b / Plans와 **동일**) |
| 스크롤 | 세로 스크롤 한 페이지 (탭 전환 시 상단 세그먼트 고정은 선택) |

---

## 4. 레이아웃 (top → bottom)

### 4.1 페이지 헤더

| 요소 | 카피 (영문 SSOT) | 스펙 |
|------|------------------|------|
| 타이틀 | `How to install your eSIM` | 26px, weight 800, `#12233F` |
| 인트로 | `This guide matches the simplyur website and app flow…` | 14px, `#6B7686`, 2~3줄 |
| 지원 문구 | `Questions? Email bongtour24@naver.com (KST 09:00–18:00).` | 12px, `#98A0AB` |

**Phase 안내 배너** (선택, Plans와 동일 톤):

- 결제·My eSIM 미오픈 시 짧은 정보 배너 1줄  
- 예: `Live now: plan catalog & install guide. Checkout & My eSIM coming soon.`  
- Plans의 coral info banner 스타일 재사용 가능 (`#FDEDE7` / `#FBD9CB`)

### 4.2 ★ 세그먼트 탭 (3개)

가로 pill/segmented control — **한 번에 하나만 활성**.

| 키 | 라벨 (EN) | 내용 |
|----|-----------|------|
| `precheck` | `Before you start` | 사전 확인 3블록 |
| `iphone` | `iPhone` | iPhone 설치 단계 |
| `android` | `Android` | Android 설치 단계 |

**선택 상태:** coral fill `#FF6B4A` + white text **또는** navy text + coral underline — Plans 일수 칩과 **시각 언어 통일**.

**미선택:** `#98A0AB` text, border `#E1DFD9`.

기본 탭: **Before you start**.

### 4.3 탭 콘텐츠 — `Before you start`

카드 3장 (또는 연속 섹션):

1. **Check device compatibility** — eSIM + 언락, 호환 기기 예시 bullet  
   - `Compatible devices` **텍스트 링크** → `/devices` (웹) / 앱 내 링크
2. **Use a stable network** — Wi‑Fi에서 설치, 실패 시 재시도 **note** (amber/warm callout)
3. **When to install** — 출발 전 설치 가능, 이용 기간은 한국 최초 접속 시 시작

각 블록: heading 15px/700 navy + body 14px muted + bullet list.

### 4.4 탭 콘텐츠 — `iPhone` / `Android`

**번호 매긴 단계(Step)** 세로 스택. 플랫폼별 4~5단계.

**iPhone 예시 단계 제목 (EN)**

1. Receive your eSIM  
2. Install the eSIM  
3. Activate in Korea  
4. Remove after your trip  

**Android 예시 단계 제목 (EN)**

1. Receive your eSIM  
2. Install the eSIM  
3. Activate in Korea  
4. Remove after your trip  

각 Step 내부:

- Step title: `1. Receive your eSIM` — 16px/700 navy
- Sub-heading (Option A/B 등): 14px/600
- Bullet list
- **Note callout** (노란/피치 박스): iPhone QR은 사진 앱으로 스캔 불가, 메뉴명 제조사별 상이 등

카드: white bg, border `#E1DFD9`, radius 18px, padding 16~18px (Plans 카드와 동일).

### 4.5 ★ FAQ 섹션 (탭 아래, 항상 표시)

세그먼트와 **독립** — 스크롤하면 탭 콘텐츠 다음에 FAQ.

| 요소 | 스펙 |
|------|------|
| 섹션 타이틀 | `FAQ — Korea eSIM` — 18px/800 navy |
| 항목 | 아코디언 — 질문만 보이다 탭하면 답변 펼침 |
| 질문 | 14px/700 navy, padding 14px |
| 답변 | 13px/400 `#6B7686`, padding 하단 14px |
| 개수 | 약 8~12개 (precheck FAQ 2 + common FAQ 6~10) |

**아코디언 인터랙션:** 한 번에 여러 개 열림 허용 (현재 앱 동작). chevron 아이콘 optional.

**Regional notices** (중국 본토 등 — Phase 1 비적용):

- 별도 소제목 + 접힌 상태 기본 **또는** 이번 handoff에서 **생략** 권장 (한국 전용만 강조)

---

## 5. 상태 (States)

| 상태 | UI |
|------|-----|
| Default | precheck 탭 + FAQ 접힘 |
| Tab switch | iPhone/Android 콘텐츠 교체, 세그먼트 highlight 이동 |
| FAQ open | 해당 항목만 답변 expand |
| Long content | 세로 스크롤, 하단 탭바 safe area |

로딩/에러 API 없음 — **정적 콘텐츠** 화면.

---

## 6. 카피 SSOT (영문 기준)

| 키 | 문구 |
|----|------|
| Title | `How to install your eSIM` |
| Tab A | `Before you start` |
| Tab B | `iPhone` |
| Tab C | `Android` |
| FAQ title | `FAQ — Korea eSIM` |
| Support | `Questions? Email bongtour24@naver.com (KST 09:00–18:00).` |
| Devices link | `Compatible devices` |

전체 단계·FAQ 본문은 `lib/simplyur/messages/en.json` → `guide.*` 및 `lib/simplyur/guide-by-locale.ts` 참고.  
5개 언어(en / ja / zh / zh-TW / vi)로 번역 — **도시명·공급사명 없음**.

---

## 7. 디자인 토큰 (Login 1b / Plans와 동일)

| 토큰 | 값 | 용도 |
|------|-----|------|
| Coral | `#FF6B4A` | 활성 세그먼트, 링크 |
| Navy | `#12233F` | 타이틀, step title, FAQ 질문 |
| Muted | `#6B7686` | 본문, FAQ 답변 |
| Faint | `#98A0AB` | 지원 문구 |
| Border | `#E1DFD9` | 카드, FAQ border |
| Note callout | amber-50 계열 **또는** `#FDEDE7` (브랜드 통일 시 피치) |
| Background | `#FFF4EF` | 페이지 전체 |
| Font | Poppins 400 / 600 / 700 / 800 | |
| Card radius | 18px | step 카드, FAQ 카드 |
| Segment/chip radius | 14px | 3탭 세그먼트 |

---

## 8. My eSIM · 사용량 조회 (참고만 — 별도 handoff)

구매 후 화면 — **이번 패키지 범위 밖**.

```
[My eSIM]  로그인 필요
  ├─ 주문 목록
  ├─ QR 보기
  └─ Data usage (사용량 조회)  ← API 있음, UI는 웹만 구현됨
```

Guide 화면에 사용량 UI를 **넣지 마세요**.

---

## 9. Out of scope

- My eSIM 전체 (QR, 사용량, 주문)
- USIM 설치 가이드
- 체크아웃·결제 폼
- Plans / Product 재디자인
- Opening / Login 재디자인
- 호환 기기 **전체 목록 페이지** (devices는 링크만)

---

## 10. 산출물 요청 (클로드 디자인)

1. **Loaded — Before you start** — 세그먼트 + precheck 3카드 + FAQ 2~3개 (접힘/펼침)
2. **iPhone tab** — 4 step 예시 1~2개 펼친 상태
3. **Android tab** — 동일
4. **FAQ expanded** — 질문 1개 열린 상태 클로즈업
5. **Component spec** — segment control, step card, note callout, FAQ accordion
6. **HTML reference** 1~2파일 (브라우저 확인 가능)

Plans handoff(`App - Plans.dc.html`)와 **같은 DC/HTML 프로토타입 형식**이면 개발팀이 가장 빠르게 맞출 수 있습니다.

---

## 11. 개발 참고 (구현 위치)

| Surface | Path |
|---------|------|
| 앱 | `apps/simplyur-mobile/app/(tabs)/guide.tsx` |
| 웹 | `app/simplyur/[locale]/guide` · `SimplyurGuideClient.tsx` |
| 카피 SSOT | `lib/simplyur/messages/*.json` (`guide`), `lib/simplyur/guide-by-locale.ts` |

현재 UI는 **기능은 갖춤, Plans 수준 픽셀 handoff는 없음** — celadon(청자) 팔레트 잔존 → **coral/navy `#FFF4EF`로 통일**이 목표.

---

## 한 줄 요약 (클로드용)

> simplyur **Install guide** 탭을 디자인해 주세요. 상단 3세그먼트(Before you start · iPhone · Android) + 하단 **FAQ 아코디언**. 배경 `#FFF4EF`, Poppins, coral `#FF6B4A` + navy `#12233F` — Plans·Login과 동일 톤. **사용량 조회·My eSIM·USIM은 넣지 마세요.**
