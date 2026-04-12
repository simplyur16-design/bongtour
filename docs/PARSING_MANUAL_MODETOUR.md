# 모두투어 상품 데이터 판독 매뉴얼 (Prisma 등록용)

모두투어 특유의 **'불포함 경비'**와 **'특전'** 구조를 분석하여 DB(Prisma)에 적재 가능한 데이터를 추출할 때 AI/파서가 반드시 체크할 항목입니다.

---

## 1. 소스 및 코드 (Source & Code)

| 필드 | 규칙 | 예시 |
|------|------|------|
| **originSource** | API·스크립트 body에는 canonical **`"modetour"`** 고정(한글 표기는 UI만) | `"modetour"` |
| **originCode** | '상품코드' 옆의 **[AVP...]** 로 시작하는 코드를 정확히 추출 | `"AVP12345678"` |

> HTTP `parse-and-register*` 요청 JSON 전체 예시: [register_schedule_expression_ssot.md](./register_schedule_expression_ssot.md) §15 · [register-supplier-extraction-spec.md](./register-supplier-extraction-spec.md) 부록-2.

---

## 2. 핵심 설정값 (Admin Checkbox 판독)

| 항목 | 판독 방법 | Prisma 필드 |
|------|-----------|-------------|
| **쇼핑 유무** | 상단 요약의 '쇼핑 3회' 등 숫자 확인. **0회가 아니면** `isNoShopping = false` | 필요 시 `includedText`에 반영 |
| **가이드비** | '불포함 사항' 섹션에 **[가이드/기사 경비 $40]** 등 금액 명시 시 `isNoGuideFeeIncluded = false` | **isGuideFeeIncluded**: false, **mandatoryLocalFee**·**mandatoryCurrency** 사용 |
| **필수 지불액** | 불포함 경비의 **숫자** → `mandatoryLocalFee`, **통화** → `mandatoryCurrency` | 예: 40, USD → `mandatoryLocalFee: 40`, `mandatoryCurrency: "USD"` |

---

## 3. 호텔 성급 (Hotel Star Rating)

- **위치**: 상품명 끝 또는 호텔 정보 섹션
- **추출**: **[4성], [5성]** 또는 호텔 성급 정보 반드시 추출
- **적재**: `title` 보강 또는 `includedText`에 반영

---

## 4. 일정표 및 특전 분석 (Schedule & Benefits)

- **상세일정**: '상세일정' 섹션을 분석하여 JSON 배열 문자열로 생성
- **스페셜 혜택(특전)**: 내용 요약 후 **includedText** 필드에 포함
- **형식** (schedule 필드):
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
- **참고:** 위 블록은 `Product.schedule`용 **일차 JSON** 예시이며 `originSource` / `brandKey` 같은 HTTP·등록 body 필드는 없다. 공급사 식별은 §1의 canonical **`modetour`** 등만 쓴다.
- **이미지 매핑**: 도시 하나당 이미지는 **1장만** 고화질로 매핑

---

## 5. Prisma 적재 시 에러 방지 (가용 필드만 사용)

- **절대 포함하지 말 것**: `bgImageUrl` (DB 등록 시 제외)
- **에러 로그에서 확인된 가용 필드**  
  `originSource`, `originCode`, `title`, `destination`, `duration`, `airline`, `schedule`, `isFuelIncluded`, `isGuideFeeIncluded`, `includedText`, `excludedText`, **mandatoryLocalFee**, **mandatoryCurrency**

등록 시 위 필드만으로 `Product` create/update payload를 구성하세요.
