# 전자명함 기능 설계 문서 (v1)

**작성일**: 2026-04-22  
**상태**: 설계 승인 대기  
**Phase**: 1 (MVP)

---

## 1. 배경 및 목표

### 배경
봉투어 영업/상담 담당자가 고객에게 링크 공유 시 "누가 보냈는지" 명확히 표시하여 신뢰도를 높이고 고객 관계를 관리하고자 함.

### 목표
- 담당자 정보가 포함된 전자명함 페이지 제공
- 페이지별 공유 시 담당자 정보 함께 노출
- 카카오톡 공유 시 브랜드 + 담당자 동시 인지
- 영업 실적 투명화 및 관리

---

## 2. 요구사항

### 기능 요구사항
- R1: 관리자가 승인한 회원만 전자명함 사용 가능
- R2: URL은 bongtour.com 하위 경로로 구성
- R3: 전자명함 페이지 (/staff/{staffId})
- R4: 페이지별 담당자 소개 (/staff/{staffId}/{page})
- R5: 카카오톡/페이스북 공유 시 OG 이미지
- R6: 문의 시 담당자 자동 할당

### 보안 요구사항
- S1: STAFF/ADMIN/SUPER_ADMIN 역할만 사용 가능
- S2: canShareCard = true 인 사람만 활성화
- S3: 비활성/퇴사 시 즉시 링크 비활성
- S4: staffId 영문/숫자/언더스코어만 허용
- S5: 존재하지 않는 staffId 접근 시 404
- S6: XSS 방지 (자기소개, 제목 등)

---

## 3. 데이터 모델

### User 모델 확장 (기존 모델 수정)

필드 추가:
- staffId: String? unique - URL용 식별자
- staffTitle: String? - 직책
- staffBio: String? Text - 자기소개 (500자)
- staffPhone: String? - 공개 연락처
- staffPhoto: String? - 프로필 사진 URL (Supabase Storage)
- staffPages: String[] - 담당 페이지 배열
- staffKakaoId: String? - 카카오톡 ID
- staffEmail: String? - 공개 이메일
- canShareCard: Boolean default false - 관리자 승인 플래그
- personalOgImage: String? - 전자명함 OG 이미지 URL
- cardViewCount: Int default 0 - 통계
- shareCount: Int default 0 - 통계

인덱스:
- @@index([staffId])
- @@index([canShareCard])

### 마이그레이션 계획
1. prisma migrate dev 로 새 필드 추가
2. 기존 데이터 영향 없음 (모두 optional)
3. 롤백 가능 (필드 삭제만 하면 됨)

---

## 4. URL 구조

### 공유 URL 형태

전자명함:
- https://bongtour.com/staff/{staffId}
- 예: https://bongtour.com/staff/hong

페이지 소개 (담당자 포함):
- https://bongtour.com/staff/{staffId}/{page}
- 예: https://bongtour.com/staff/hong/private-trip
- pages: private-trip, training, overseas, domestic, esim

카카오톡 미리보기:
- 도메인: bongtour.com
- 제목: 페이지 + 담당자 이름
- 이미지: 전자명함 OG 이미지

---

## 5. 페이지 구조

### /staff/[staffId]/page.tsx (전자명함)

컴포넌트:
- 프로필 사진 (원형, 150px)
- 이름 + 직책
- 자기소개
- 연락 수단 (전화, 이메일, 카카오톡)
- 담당 분야 (카드 형태로 하위 페이지 링크)
- 문의 버튼 (담당자 자동 지정)

### /staff/[staffId]/[slug]/page.tsx (페이지 + 배너)

컴포넌트:
- 기존 페이지 콘텐츠 그대로
- 상단에 담당자 배너 추가
- 하단에 담당자 전용 문의 CTA
- ?staffId={staffId} 쿼리로 문의 폼 연결

### 권한 체크 플로우

```ts
function getStaffUser(staffId) {
  const user = await prisma.user.findUnique({
    where: { staffId },
    select: { ... staff 필드들, role, accountStatus }
  })
  
  if (!user) return null
  if (user.accountStatus !== 'active') return null
  if (!user.canShareCard) return null
  if (!['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null
  
  return user
}
```

존재 안 하면 notFound() 호출 → Next.js 404

---

## 6. 관리자 UI

### /admin/members 페이지 확장

기존 테이블:
- 이름, 이메일, 역할, 상태

추가 컬럼:
- 전자명함 활성화 (canShareCard 체크박스)
- staffId (인라인 편집)
- 상세 버튼 → 편집 모달

### 전자명함 편집 모달

필드:
- staffId (필수, unique 검증)
- 직책 (text)
- 자기소개 (textarea, 500자)
- 전화번호
- 이메일 (공개용)
- 카카오톡 ID
- 프로필 사진 업로드 (Supabase Storage)
- 담당 페이지 (multi-select)
  - ☐ 우리끼리 여행
  - ☐ 국외 연수
  - ☐ 해외여행
  - ☐ 국내여행
  - ☐ e-SIM
- OG 이미지 업로드 (선택)

저장 시:
- staffId 유효성 검사 (영문+숫자+_ only)
- 중복 체크
- 권한 검증 (ADMIN 이상)
- 감사 로그

---

## 7. 보안 및 검증

### staffId 규칙
- 영문 소문자, 숫자, 언더스코어만
- 3~20자
- 예약어 금지: admin, api, auth, ...
- 정규식: ^[a-z][a-z0-9_]{2,19}$

### 404 처리 (정보 누출 방지)
- 없는 staffId → 404
- 비활성 사용자 → 404
- canShareCard=false → 404
- (존재 여부 드러내지 않음)

### Rate Limiting (추후)
- 같은 IP에서 1분에 60회 이상 요청 차단
- 존재하지 않는 staffId 과도한 조회 차단

### XSS 방지
- staffBio, staffTitle은 React 기본 이스케이프
- Markdown 금지 (텍스트만)

---

## 8. OG 이미지 전략

### Phase 1 (MVP): 정적 이미지
- 관리자가 직원 등록 시 OG 이미지 업로드
- 없으면 기본 템플릿 (봉투어 로고)
- Supabase Storage: bongtour-images/staff-og/{staffId}.png

### Phase 2: 동적 생성 (추후)
- @vercel/og 라이브러리
- 배경 + 프로필 사진 + 이름 + 직책 자동 합성
- 페이지별 다른 템플릿

---

## 9. 구현 Phase

### Phase 1: MVP (예상 3~4시간)
1. Prisma schema 확장 + migration
2. /admin/members 에 전자명함 섹션 추가
3. /staff/[staffId]/page.tsx 생성
4. 기본 OG 이미지 설정
5. 테스트

### Phase 2: 페이지 소개 (예상 2~3시간)
1. /staff/[staffId]/[slug]/page.tsx 생성
2. 기존 페이지에 담당자 배너 컴포넌트 추가
3. 문의 폼에 담당자 자동 할당
4. 각 페이지별 metadata

### Phase 3: 고도화 (예상 4~6시간)
1. @vercel/og 동적 이미지 생성
2. 짧은 URL (/s/abc)
3. QR 코드 생성
4. 통계 대시보드
5. 직원 셀프 관리 UI

---

## 10. 테스트 시나리오

### 정상 케이스
- [ ] 관리자가 staffId 'hong' 부여
- [ ] canShareCard = true 설정
- [ ] /staff/hong 접속 시 명함 페이지 표시
- [ ] OG 이미지 카톡 공유 확인
- [ ] /staff/hong/private-trip 접속 시 페이지 + 배너

### 에러 케이스
- [ ] 없는 staffId 접속 → 404
- [ ] canShareCard=false → 404
- [ ] USER 역할 → 404
- [ ] 비활성 계정 → 404
- [ ] staffId 중복 시도 → 실패 메시지

### 보안 케이스
- [ ] SQL 인젝션 시도 → 정규식에서 차단
- [ ] XSS 시도 (bio에 스크립트) → 이스케이프
- [ ] 권한 없는 사용자의 편집 시도 → 403

---

## 11. 향후 확장

### 별도 앱 (전자명함 SaaS)
- 봉투어에서 검증된 후 별도 서비스로 분리
- 다른 회사/개인도 사용 가능
- 구독 모델

### 기능 확장
- 방문자 분석
- A/B 테스트 (OG 이미지)
- 자동 팔로업 메시지
- CRM 연동

---

## 12. 오픈 이슈

- [ ] staffId 변경 가능 여부? (일반적으로 불가)
- [ ] 퇴사자 데이터 보존 기간?
- [ ] 동일인 여러 staffId 허용? (기본 X)
- [ ] OG 이미지 자동 생성 vs 수동 업로드?
- [ ] 문의 자동 할당 실패 시 fallback?

---

**Phase 1 MVP부터 시작. 필요 시 Phase 확장.**
