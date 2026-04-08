# 반려 사유 기록 기능 (MVP)

**목표**: 반려 시 간단한 사유를 저장하고, 상품목록/상세/등록대기에서 확인할 수 있게 한다.

---

## 1. 반려 사유 기능의 필요성 요약

- 등록대기에서 반려한 상품은 `rejected` 상태로만 남고, **이유가 없어** 나중에 상품목록에서 보거나 재검수할 때 판단이 어렵다.
- 운영 메모/검수 기록 성격으로 **반려 사유(rejectReason) + 반려 시각(rejectedAt)** 를 남기면, 복구·재검수·이력 확인에 도움이 된다.
- B2C 상담유도형·직접예약 없음 전제에 맞춰, 과하지 않은 **최소 필드 + 최소 UI** 로 구현.

---

## 2. Prisma 수정안

**Product 모델에 추가:**

```prisma
  rejectReason          String?        // 반려 시 사유 (최대 200자, 운영 메모 성격)
  rejectedAt            DateTime?      // 반려 처리 시각
```

- **rejectReason**: 반려 이유를 자유 텍스트로 저장. null 허용 = 사유 없이 반려 가능(선택 입력). 최대 200자.
- **rejectedAt**: 반려한 시점 기록. null 허용 = 반려가 아니면 null.
- **Migration**: 필드 추가이므로 `npx prisma migrate dev --name add_reject_reason` 실행 필요. 기존 row는 두 필드 모두 null.

---

## 3. API 수정안

### PATCH /api/admin/products/[id]

- **registrationStatus를 `rejected`로 보낼 때**
  - `rejectReason`을 body에서 받아 trim 후 최대 200자로 저장. 미전송/빈 문자열이면 null.
  - `rejectedAt`은 서버에서 `new Date()` 로 설정.
- **registrationStatus를 pending/registered/on_hold로 바꿀 때**
  - `rejectReason`, `rejectedAt`을 **null로 초기화** (다시 검수/보류/등록하면 반려 이력 필드 비움).

### GET /api/admin/products/[id]

- 응답 select에 `rejectReason`, `rejectedAt` 포함. 상세에서 반려 사유·시각 확인 가능.

### GET /api/admin/products/list

- select 및 응답 rows에 `rejectReason`, `rejectedAt` 포함. `rejectedAt`은 ISO 문자열로 직렬화.

### GET /api/admin/products/pending

- 등록대기는 pending만 조회하므로 반려 건 미포함. **변경 없음.**

---

## 4. AdminPendingDetailPanel UI 패치 초안

- **[반려]** 클릭 시 기존처럼 바로 API 호출하지 않고, **인라인 폼** 표시.
- 폼 내용:
  - 라벨: "반려 사유 (선택, 최대 200자)"
  - `<textarea>` 2줄, placeholder: "예: 중복 상품, 이미지 부족, 정보 불충분, 노출 부적합"
  - 글자 수 표시: `{rejectReasonText.length}/200`
  - **[반려 확인]**: `onReject(detail.id, rejectReasonText.trim() || undefined)` 호출 후 폼 닫기.
  - **[취소]**: 폼만 닫기.
- 상태: `showRejectForm`, `rejectReasonText`. [반려] 클릭 시 `showRejectForm = true`, [취소] 또는 반려 완료 후 `showRejectForm = false`.

---

## 5. 상품목록 표시 방식 제안

- **상태 컬럼**: rejected일 때 기존처럼 반려 배지 표시.
- **반려 사유**: 같은 셀 안에서 배지 아래에 `rejectReason`이 있으면 한 줄로 표시. `truncate` + `title`로 전체 툴팁.
- 별도 컬럼 추가 없이 **보조 텍스트**로만 표시. 상품 상세 페이지에서 전체 사유·rejectedAt 확인 가능.

---

## 6. MVP에서 실제 반영할 최소안

| 항목 | 내용 |
|------|------|
| **Prisma** | Product에 `rejectReason` String?, `rejectedAt` DateTime? 추가. |
| **PATCH [id]** | status=rejected 시 rejectReason(200자 제한), rejectedAt(서버 설정). status가 다른 값으로 바뀌면 rejectReason/rejectedAt null. |
| **GET [id], GET list** | 응답에 rejectReason, rejectedAt 포함. |
| **등록대기 패널** | [반려] → 인라인 사유 입력 + [반려 확인][취소]. onReject(id, reason?). |
| **pending page** | handleReject(id, reason) → PATCH에 rejectReason 포함. |
| **상품목록** | ProductRow에 rejectReason, rejectedAt. 상태 셀에 반려 배지 + 사유 한 줄(truncate). |

---

## 7. 운영 규칙 제안

- **반려 사유**: **선택**. 입력하지 않아도 반려 가능. MVP는 운영 메모 성격만 반영.
- **길이 제한**: **200자**.
- **예시 사유**: 중복 상품, 이미지 부족, 정보 불충분, 노출 부적합, 파싱 오류 등 (placeholder/가이드용).

---

## 8. 후속 TODO

- 상품 상세 페이지(/admin/products/[id])에서 반려 사유·rejectedAt 블록 표시.
- 반려 사유를 필수로 바꾸거나, 짧은 선택지(드롭다운) + 자유 입력 혼합 검토.
- 반려 이력이 여러 번이면 이전 사유 보존 여부 검토(현재는 1회만, 덮어쓰기).
