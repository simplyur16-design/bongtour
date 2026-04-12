# 하나투어 상품 데이터 판독 매뉴얼 (Prisma 등록용)

하나투어 특유의 상품 구조를 분석하여 DB(Prisma) `Product` 모델에 **즉시 등록 가능한** 데이터를 추출할 때 AI/파서가 반드시 체크할 항목입니다.

---

## 1. 소스 및 코드 (Source & Code)

| 필드 | 규칙 | 예시 |
|------|------|------|
| **originSource** | API·스크립트 body에는 canonical **`"hanatour"`** 고정(한글 표기는 UI만) | `"hanatour"` |
| **originCode** | '상품코드' 옆의 **[ATP...]** 로 시작하는 코드를 정확히 추출 | `"ATP12345678"` |

> HTTP `parse-and-register*` 요청 JSON 전체 예시: [register_schedule_expression_ssot.md](./register_schedule_expression_ssot.md) §15 · [register-supplier-extraction-spec.md](./register-supplier-extraction-spec.md) 부록-2.

---

## 2. 핵심 설정값 (Admin Checkbox 판독)

| 항목 | 판독 방법 | Prisma/비고 |
|------|-----------|-------------|
| **브랜드 등급** | '하나팩 2.0' 옆 **[스탠다드 / 세이브 / 프리미엄]** 식별 | `counselingNotes` 또는 메모 필드에 기록 권장 |
| **쇼핑 유무** | '쇼핑없음' 문구 → `isNoShopping = true` / '쇼핑 N회' → `false` | 필요 시 확장 필드 또는 `includedText`에 반영 |
| **가이드비** | '가이드경비없음'이 상단 핵심정보 또는 포함사항에 있으면 `isNoGuideFeeIncluded = true` | **isGuideFeeIncluded**: true = 포함, false = 불포함 |
| **선택관광** | '선택관광없음' 또는 '노옵션' 확인 시 `isNoOption = true` | 필요 시 확장 필드 또는 `includedText`에 반영 |

---

## 3. 호텔 성급 (Hotel Star Rating)

- **위치**: '호텔 & 관광지' 섹션 또는 예정 호텔 리스트 옆
- **추출**: **[4성급], [5성급], [특급]** 등 키워드 반드시 추출
- **적재**: `title` 보강 또는 `includedText` / 별도 메모 필드에 반영

---

## 4. 일정표 분석 (Schedule)

- **섹션**: '여행일정'을 **일차별(Day)** 로 쪼개기
- **형식**: JSON 배열 문자열 (Product.schedule 필드)
- **필드**:
  ```json
  [
    {
      "day": 1,
      "title": "...",
      "description": "...",
      "imageKeyword": "...",
      "imageUrl": "..."
    }
  ]
  ```
- **참고:** 위 블록은 `Product.schedule`용 **일차 JSON** 예시이며 `originSource` / `brandKey` 같은 HTTP·등록 body 필드는 없다. 공급사 식별은 §1의 canonical **`hanatour`** 등만 쓴다.
- **이미지 매핑**: 한 도시(예: 타이베이)당 이미지는 **1장만**, 가장 고화질로 선택

---

## 5. Prisma 적재 시 에러 방지 (가용 필드만 사용)

- **절대 포함하지 말 것**: `bgImageUrl` (DB 등록 시 제외)
- **사용 가능 필드**  
  `originSource`, `originCode`, `title`, `destination`, `duration`, `airline`, `schedule`, `isFuelIncluded`, `isGuideFeeIncluded`, `includedText`, `excludedText`

등록 시 위 필드만으로 `Product` create/update payload를 구성하세요.
